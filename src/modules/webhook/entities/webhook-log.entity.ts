import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type WebhookStatus = 'queued' | 'processing' | 'success' | 'failed';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ type: 'varchar', nullable: true, name: 'RecordID' })
  recordId: string;

  // complete payload we processed
  //   @Column({ type: 'jsonb', name: 'Payload' })
  //   payload: Record<string, any>;

  @Column({ type: 'varchar', length: 20, name: 'Status' })
  status: WebhookStatus;

  @Column({ type: 'varchar', length: 50, name: 'Type' })
  type: string;

  @Column({ type: 'text', nullable: true, name: 'Message' })
  message: string | null;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    nullable: true,
    name: 'CreatedDate',
  })
  createdDate: Date | null;
}
