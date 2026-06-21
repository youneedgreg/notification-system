import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('templates')
@Index(['code', 'language'], { unique: true })
export class Template {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  html_content: string;

  @Column({ type: 'text', nullable: true })
  text_content: string;

  @Column('simple-array', { nullable: true })
  variables: string[];

  @Column({ default: 'email' })
  type: string;

  @Column({ default: 'en' })
  language: string;

  @Column({ default: 1 })
  version: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
