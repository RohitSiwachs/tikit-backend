import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { EventType } from '../common/enums.js';
import { School } from './school.entity.js';
import { User } from './user.entity.js';
import { TicketType } from './ticket-type.entity.js';
import { Venue } from './venue.entity.js';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  school_id: string;

  @ManyToOne(() => School, (school) => school.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cover_image_url: string;

  @Column({ type: 'enum', enum: EventType, default: EventType.INTERNAL })
  event_type: EventType;

  /** Category for feed tabs (klubb, sport, gasque) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  @Column({ type: 'uuid', nullable: true })
  venue_id: string;

  @ManyToOne(() => Venue, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @Column({ type: 'timestamptz' })
  starts_at: Date;

  @Column({ type: 'timestamptz' })
  ends_at: Date;

  @Column({ type: 'boolean', default: false })
  is_sold_out: boolean;

  @Column({ type: 'boolean', default: false })
  is_draft: boolean;

  /** Linked membership card from Figma "Koppla festkort" dropdown */
  @Column({ type: 'uuid', nullable: true })
  linked_card_id: string;

  /** Per-event secret used to sign QR ticket JWTs */
  @Column({ type: 'varchar', length: 64 })
  qr_secret: string;

  @OneToMany(() => TicketType, (tt) => tt.event)
  ticket_types: TicketType[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
