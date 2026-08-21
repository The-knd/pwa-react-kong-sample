import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sales')
@Index('idx_sales_created_at', ['createdAt'])
@Index('idx_sales_seller_id', ['sellerId'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** sin FK: el cliente vive en clients_db (database-per-service) */
  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: string;

  @Column({ type: 'enum', enum: ['completed', 'voided'] })
  status: 'completed' | 'voided';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
