import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedPost } from '../entities/feed-post.entity.js';
import { PostLike } from '../entities/post-like.entity.js';
import { Comment } from '../entities/comment.entity.js';
import { Poll } from '../entities/poll.entity.js';
import { PollOption } from '../entities/poll-option.entity.js';
import { PollVote } from '../entities/poll-vote.entity.js';

@Injectable()
export class FeedService {
  constructor(
    @InjectRepository(FeedPost) private readonly postRepo: Repository<FeedPost>,
    @InjectRepository(PostLike) private readonly likeRepo: Repository<PostLike>,
    @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
    @InjectRepository(Poll) private readonly pollRepo: Repository<Poll>,
    @InjectRepository(PollOption) private readonly optionRepo: Repository<PollOption>,
    @InjectRepository(PollVote) private readonly voteRepo: Repository<PollVote>,
  ) {}

  // ─── Feed Posts ──────────────────────────────────────────
  async getFeed(query: { tab?: string; page?: number; limit?: number }, userId: string) {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.postRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.author', 'a')
      .leftJoinAndSelect('p.school', 's')
      .leftJoinAndSelect('p.event', 'e')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.tab === 'event') {
      qb.andWhere('p.post_type = :type', { type: 'event_promo' });
    }

    const [data, total] = await qb.getManyAndCount();

    // Enrich with user like status and poll data
    const enriched = await Promise.all(
      data.map(async (post) => {
        const isLiked = await this.likeRepo.findOne({
          where: { user_id: userId, post_id: post.id },
        });
        let poll: Poll | null = null;
        if (post.post_type === 'poll') {
          poll = await this.pollRepo.findOne({
            where: { post_id: post.id },
            relations: ['options'],
          });
          if (poll) {
            const userVote = await this.voteRepo.findOne({
              where: { poll_id: poll.id, user_id: userId },
            });
            (poll as any).user_voted_option_id = userVote?.option_id || null;
          }
        }
        return { ...post, is_liked: !!isLiked, poll };
      }),
    );

    return {
      data: enriched,
      meta: { page, total_pages: Math.ceil(total / limit), total_count: total },
    };
  }

  async createPost(data: { content?: string; image_url?: string; event_id?: string; post_type?: string }, userId: string, schoolId?: string) {
    const post = this.postRepo.create({
      content: data.content,
      image_url: data.image_url,
      event_id: data.event_id,
      post_type: (data.post_type as any) || 'text',
      author_id: userId,
      school_id: schoolId,
    });
    return this.postRepo.save(post);
  }

  async likePost(postId: string, userId: string) {
    const exists = await this.likeRepo.findOne({ where: { user_id: userId, post_id: postId } });
    if (exists) throw new ConflictException('Already liked');
    await this.likeRepo.save({ user_id: userId, post_id: postId });
    await this.postRepo.increment({ id: postId }, 'likes_count', 1);
    return { liked: true };
  }

  async unlikePost(postId: string, userId: string) {
    const result = await this.likeRepo.delete({ user_id: userId, post_id: postId });
    if (result.affected === 0) throw new NotFoundException('Like not found');
    await this.postRepo.decrement({ id: postId }, 'likes_count', 1);
    return { liked: false };
  }

  // ─── Comments ────────────────────────────────────────────
  async getComments(postId: string, page = 1, limit = 20) {
    const [data, total] = await this.commentRepo.findAndCount({
      where: { post_id: postId, parent_id: undefined as any },
      relations: ['author', 'replies', 'replies.author', 'mentioned_user'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, total_pages: Math.ceil(total / limit), total_count: total } };
  }

  async addComment(postId: string, data: { content: string; parent_id?: string; mentioned_user_id?: string }, userId: string) {
    const comment = this.commentRepo.create({
      post_id: postId,
      author_id: userId,
      content: data.content,
      parent_id: data.parent_id,
      mentioned_user_id: data.mentioned_user_id,
    });
    const saved = await this.commentRepo.save(comment);
    await this.postRepo.increment({ id: postId }, 'comments_count', 1);
    return saved;
  }

  // ─── Polls ───────────────────────────────────────────────
  async votePoll(pollId: string, optionId: string, userId: string) {
    const exists = await this.voteRepo.findOne({ where: { poll_id: pollId, user_id: userId } });
    if (exists) throw new ConflictException('Already voted');
    await this.voteRepo.save({ poll_id: pollId, option_id: optionId, user_id: userId });
    await this.optionRepo.increment({ id: optionId }, 'votes_count', 1);
    await this.pollRepo.increment({ id: pollId }, 'total_votes', 1);
    return { voted: true };
  }
}
