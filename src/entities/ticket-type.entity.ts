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
import { Event } from './event.entity.js';
import { Ticket } from './ticket.entity.js';

@Entity('ticket_types')
export class TicketType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  event_id: string;

  @ManyToOne(() => Event, (event) => event.ticket_types, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Price in the smallest currency unit (e.g. öre for SEK) */
  @Column({ type: 'integer', default: 0 })
  price: number;

  @Column({ type: 'varchar', length: 3, default: 'SEK' })
  currency: string;

  @Column({ type: 'integer' })
  total_inventory: number;

  @Column({ type: 'integer', default: 0 })
  sold_count: number;

  /** External link (e.g. biletto.se) from Figma event creation form */
  @Column({ type: 'varchar', length: 500, nullable: true })
  external_link: string;

  /** Whether this ticket requires a membership card */
  @Column({ type: 'boolean', default: false })
  requires_membership: boolean;

  @Column({ type: 'uuid', nullable: true })
  linked_card_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  sale_starts_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sale_ends_at: Date;

  @OneToMany(() => Ticket, (ticket) => ticket.ticket_type)
  tickets: Ticket[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
