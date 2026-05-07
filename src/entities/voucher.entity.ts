import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TicketType } from './ticket-type.entity.js';
import { User } from './user.entity.js';

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Admin-generated voucher code */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'uuid' })
  ticket_type_id: string;

  @ManyToOne(() => TicketType, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_type_id' })
  ticket_type: TicketType;

  @Column({ type: 'uuid', nullable: true })
  assigned_to: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_to' })
  user: User;

  @Column({ type: 'boolean', default: false })
  is_redeemed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  redeemed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
