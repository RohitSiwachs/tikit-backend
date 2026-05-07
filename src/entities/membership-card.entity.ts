import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CardType, CardStatus } from '../common/enums.js';
import { User } from './user.entity.js';
import { School } from './school.entity.js';

@Entity('membership_cards')
export class MembershipCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  school_id: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'enum', enum: CardType, default: CardType.FESTKORT })
  card_type: CardType;

  /** Display name e.g. "FESTKORT 26", "VIP KORT PREMIUM" */
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  issuer: string;

  @Column({ type: 'date' })
  valid_until: Date;

  @Column({ type: 'enum', enum: CardStatus, default: CardStatus.ACTIVE })
  status: CardStatus;

  /** Perks list (JSON array of strings) */
  @Column({ type: 'jsonb', nullable: true })
  perks: string[];

  /** Member ID shown on card e.g. "KID-000-002-631-063" */
  @Column({ type: 'varchar', length: 50, nullable: true })
  member_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  activated_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
