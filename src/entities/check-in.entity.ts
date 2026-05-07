import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';
import { Event } from './event.entity.js';
import { Venue } from './venue.entity.js';

@Entity('check_ins')
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  event_id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'uuid', nullable: true })
  venue_id: string;

  @ManyToOne(() => Venue, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'venue_id' })
  venue: Venue;

  @CreateDateColumn({ type: 'timestamptz' })
  checked_in_at: Date;
}
