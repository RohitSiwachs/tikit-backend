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
import { TicketStatus } from '../common/enums.js';
import { User } from './user.entity.js';
import { Event } from './event.entity.js';
import { TicketType } from './ticket-type.entity.js';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Unique 12-digit numeric code printed on the ticket */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 12, unique: true })
  code: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, (user) => user.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  event_id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'uuid' })
  ticket_type_id: string;

  @ManyToOne(() => TicketType, (tt) => tt.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_type_id' })
  ticket_type: TicketType;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.VALID })
  status: TicketStatus;

  /** Signed JWT for QR code scanning — generated at ticket issuance */
  @Column({ type: 'text', nullable: true })
  qr_token: string;

  @Column({ type: 'timestamptz', nullable: true })
  checked_in_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
