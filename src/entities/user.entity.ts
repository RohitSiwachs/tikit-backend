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
import { Exclude } from 'class-transformer';
import { UserRole } from '../common/enums.js';
import { School } from './school.entity.js';
import { Ticket } from './ticket.entity.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  display_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string;

  @Exclude()
  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  /** Födelsedatum — ÅÅÅÅ-MM-DD from Figma register form */
  @Column({ type: 'date', nullable: true })
  birth_date: Date;

  /** Årskurs dropdown (1-3) from Figma register form */
  @Column({ type: 'smallint', nullable: true })
  school_year: number;

  /** Klass dropdown (e.g. "NA2B") from Figma register form */
  @Column({ type: 'varchar', length: 20, nullable: true })
  class_name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true })
  school_id: string;

  @ManyToOne(() => School, (school) => school.users, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'varchar', length: 500, nullable: true })
  push_token: string;

  /** Hashed refresh token stored for rotation */
  @Exclude()
  @Column({ type: 'varchar', length: 500, nullable: true })
  refresh_token_hash: string;

  @OneToMany(() => Ticket, (ticket) => ticket.user)
  tickets: Ticket[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
