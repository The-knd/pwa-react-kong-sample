import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Catálogo seed; en fase 2 tendrá su propio microservicio. */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  sku: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string; // numeric llega como string desde pg

  @Column({ type: 'int' })
  stock: number;
}
