import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('integration_delivery_logs')
@Index(['webhookId', 'channel'])
export class IntegrationDeliveryLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ type: 'varchar', length: 100, name: 'WebhookId' })
  webhookId: string;

  @Column({ type: 'varchar', length: 20, name: 'Channel' })
  channel: string;

  @Column({ type: 'varchar', length: 50, name: 'Provider', nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', length: 20, name: 'Status' })
  status: string; // 'sent' | 'failed'

  @Column({ type: 'varchar', length: 100, name: 'RecipientMasked', nullable: true })
  recipientMasked: string | null;

  @Column({ type: 'varchar', length: 200, name: 'ExternalId', nullable: true })
  externalId: string | null;

  @Column({ type: 'text', name: 'ErrorMessage', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', name: 'RetryCount', default: 0 })
  retryCount: number;

  @Column({ type: 'varchar', length: 100, name: 'CorrelationId', nullable: true })
  correlationId: string | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    name: 'CreatedAt',
  })
  createdAt: Date;
}
