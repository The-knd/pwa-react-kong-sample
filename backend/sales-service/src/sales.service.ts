import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { JwtPayload } from '@app/common';
import { DataSource, Repository } from 'typeorm';
import { CreateSaleDto } from './dto/create-sale.dto';
import { Product } from './entities/product.entity';
import { Sale } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale) private readonly salesRepo: Repository<Sale>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * Crea la venta de forma transaccional: valida stock, descuenta inventario
   * y persiste cabecera + líneas atómicamente. El precio SIEMPRE se toma del
   * catálogo (nunca del cliente).
   */
  async create(dto: CreateSaleDto, actor: JwtPayload) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    try {
      const manager = queryRunner.manager;
      let total = 0;
      const lines: Array<Pick<SaleItem, 'productId' | 'quantity' | 'unitPrice'>> = [];

      for (const item of dto.items) {
        const product = await manager.findOneBy(Product, { id: item.productId });
        if (!product) {
          throw new NotFoundException(`Producto ${item.productId} no existe`);
        }
        if (product.stock < item.quantity) {
          throw new ConflictException(`Stock insuficiente para "${product.name}"`);
        }

        total += Number(product.price) * item.quantity;
        lines.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
        });

        // Descuento atómico condicional: falla si otro vendedor consumió el stock primero
        const affected = await manager
          .createQueryBuilder()
          .update(Product)
          .set({ stock: () => 'stock - :qty' })
          .where('id = :id AND stock >= :qty', { id: product.id, qty: item.quantity })
          .execute();
        if (!affected.affected) {
          throw new ConflictException(`Stock cambió para "${product.name}", reintenta`);
        }
      }

      const sale = await manager.save(Sale, {
        clientId: dto.clientId,
        sellerId: actor.sub,
        total: total.toFixed(2),
      });

      await manager.insert(SaleItem, lines.map((line) => ({ ...line, saleId: sale.id })));

      await queryRunner.commitTransaction();
      return { id: sale.id, total: sale.total, status: sale.status };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Listado para el admin con sus líneas agregadas (json_agg). */
  async findAll(limit = 50, offset = 0) {
    const rows = await this.salesRepo.query(
      `SELECT s.id,
              s.client_id   AS "clientId",
              s.seller_id   AS "sellerId",
              s.total,
              s.status,
              s.created_at  AS "createdAt",
              COALESCE(
                json_agg(
                  json_build_object(
                    'productId', i.product_id,
                    'quantity',  i.quantity,
                    'unitPrice', i.unit_price
                  )
                ) FILTER (WHERE i.id IS NOT NULL),
                '[]'
              ) AS items
         FROM sales s
         LEFT JOIN sale_items i ON i.sale_id = s.id
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const [{ count }] = await this.salesRepo.query('SELECT count(*)::int AS count FROM sales');
    return { items: rows, total: Number(count) };
  }
}
