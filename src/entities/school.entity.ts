import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity.js';
import { Event } from './event.entity.js';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string;

  @Column({ type: 'boolean', default: false })
  is_verified: boolean;

  /** 8-character code students use to register under this school */
  @Column({ type: 'varchar', length: 8, unique: true, nullable: true })
  school_code: string;

  @OneToMany(() => User, (user) => user.school)
  users: User[];

  @OneToMany(() => Event, (event) => event.school)
  events: Event[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
