import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type DocType = 'CC' | 'CE' | 'NIT' | 'PAS';

@Entity('clients')
@Index('idx_clients_name', ['name'])
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'doc_type', type: 'enum', enum: ['CC', 'CE', 'NIT', 'PAS'] })
  docType: DocType;

  @Column({ name: 'doc_number', type: 'varchar', length: 20 })
  docNumber: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string | null;

  /** id del usuario (vendedor/admin) que lo creó; sin FK: vive en users_db */
  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
