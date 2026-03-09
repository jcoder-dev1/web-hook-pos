import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Read-only mapping to master DB table third_party_integrations.
 * Used by web-hook-pos to resolve integration config by (mpin, companyId, branchId, channel).
 */
@Entity('third_party_integrations')
@Index(['mpin', 'companyId', 'branchId', 'channel'], { unique: true })
export class ThirdPartyIntegration {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ type: 'varchar', length: 50, name: 'MPIN' })
  mpin: string;

  @Column({ type: 'int', name: 'CompanyId' })
  companyId: number;

  @Column({ type: 'int', name: 'BranchId', nullable: true })
  branchId: number | null;

  @Column({ type: 'varchar', length: 50, name: 'Channel' })
  channel: string;

  @Column({ type: 'varchar', length: 100, name: 'Provider' })
  provider: string;

  @Column({ type: 'boolean', default: true, name: 'IsActive' })
  isActive: boolean;

  @Column({ type: 'text', name: 'ConfigEncrypted' })
  configEncrypted: string;

  @Column({ type: 'varchar', length: 500, name: 'EventTypes', nullable: true })
  eventTypes: string | null;

  @CreateDateColumn({ name: 'CreatedAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'UpdatedAt' })
  updatedAt: Date;
}
