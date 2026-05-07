import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { FeedPost } from './feed-post.entity.js';
import { PollOption } from './poll-option.entity.js';

@Entity('polls')
export class Poll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  post_id: string;

  @ManyToOne(() => FeedPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: FeedPost;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'integer', default: 0 })
  total_votes: number;

  @Column({ type: 'timestamptz', nullable: true })
  closes_at: Date;

  @OneToMany(() => PollOption, (o) => o.poll)
  options: PollOption[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
