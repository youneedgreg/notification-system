import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_status')
@Index(['user_id', 'created_at'])
@Index(['status', 'created_at'])
export class NotificationStatus {
  @PrimaryColumn('uuid')
  notification_id: string;

  @Column('uuid')
  @Index()
  user_id: string;

  @Column({ length: 50 })
  @Index()
  notification_type: string;

  @Column({ length: 50 })
  @Index()
  status: string;

  @Column({ length: 255, unique: true })
  @Index()
  request_id: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
