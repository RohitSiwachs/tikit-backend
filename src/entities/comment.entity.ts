import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity.js';
import { FeedPost } from './feed-post.entity.js';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  post_id: string;

  @ManyToOne(() => FeedPost, (p) => p.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: FeedPost;

  @Column({ type: 'uuid' })
  author_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  /** Parent comment for nested replies (1 level) */
  @Column({ type: 'uuid', nullable: true })
  parent_id: string;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment;

  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];

  @Column({ type: 'text' })
  content: string;

  /** @mention target from Figma comments screen */
  @Column({ type: 'uuid', nullable: true })
  mentioned_user_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'mentioned_user_id' })
  mentioned_user: User;

  @Column({ type: 'integer', default: 0 })
  likes_count: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
