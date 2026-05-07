import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedService } from './feed.service.js';
import { FeedController } from './feed.controller.js';
import { FeedPost } from '../entities/feed-post.entity.js';
import { PostLike } from '../entities/post-like.entity.js';
import { Comment } from '../entities/comment.entity.js';
import { Poll } from '../entities/poll.entity.js';
import { PollOption } from '../entities/poll-option.entity.js';
import { PollVote } from '../entities/poll-vote.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([FeedPost, PostLike, Comment, Poll, PollOption, PollVote])],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
