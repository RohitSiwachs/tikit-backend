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
import { PostType } from '../common/enums.js';
import { User } from './user.entity.js';
import { School } from './school.entity.js';
import { Event } from './event.entity.js';
import { Comment } from './comment.entity.js';

@Entity('feed_posts')
export class FeedPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  author_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'uuid', nullable: true })
  school_id: string;

  @ManyToOne(() => School, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'uuid', nullable: true })
  event_id: string;

  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event: Event;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string;

  @Column({ type: 'enum', enum: PostType, default: PostType.TEXT })
  post_type: PostType;

  @Column({ type: 'integer', default: 0 })
  likes_count: number;

  @Column({ type: 'integer', default: 0 })
  comments_count: number;

  @OneToMany(() => Comment, (c) => c.post)
  comments: Comment[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
