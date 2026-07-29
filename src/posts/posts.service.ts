import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { PostType } from '../common';
import { CacheService } from '../cache/cache.service';
import { CK, TTL } from '../cache/cache-keys';

const POST_AUTHOR_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
} as const;

function formatPost(post: any, userId?: string) {
  if (!post) return post;
  if (post.postType === PostType.COUNTDOWN) {
    const { pollOptions, pollVotes, ...rest } = post;
    return rest;
  }
  if (post.postType !== PostType.POLL) {
    // Destructure out the relation properties we don't need for non-polls
    const { pollOptions, pollVotes, ...rest } = post;
    return rest;
  }

  const pollOptions = post.pollOptions || [];
  const pollVotes = post.pollVotes || [];

  // Total votes for this poll
  const totalVotes = pollOptions.reduce(
    (sum, opt) => sum + (opt._count?.votes || 0),
    0,
  );

  // Determine user's vote (filter by userId returns at most 1 element)
  const userVotedOptionId = pollVotes.length > 0 ? pollVotes[0].optionId : null;

  const options = pollOptions.map((opt) => {
    const votesCount = opt._count?.votes || 0;
    const percentage =
      totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
    return {
      id: opt.id,
      text: opt.text,
      votesCount,
      percentage,
    };
  });

  const now = new Date();
  const isExpired = post.pollExpiresAt
    ? new Date(post.pollExpiresAt) < now
    : false;

  const { pollOptions: _, pollVotes: __, ...postRest } = post;

  return {
    ...postRest,
    poll: {
      expiresAt: post.pollExpiresAt,
      expired: isExpired,
      options,
      userVotedOptionId,
      totalVotes,
    },
  };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(createPostDto: CreatePostDto, authorId: string) {
    // Validate scheduledAt if provided
    let scheduledAt: Date | undefined;
    if (createPostDto.scheduledAt) {
      scheduledAt = new Date(createPostDto.scheduledAt);
      if (isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        throw new BadRequestException(
          'scheduledAt must be a valid date in the future',
        );
      }
    }

    if (createPostDto.postType === PostType.COUNTDOWN) {
      if (!createPostDto.title) {
        throw new BadRequestException('Countdown posts must have a title');
      }
      if (!createPostDto.eventDateTime) {
        throw new BadRequestException(
          'Countdown posts must have an eventDateTime',
        );
      }
      const eventDateTime = new Date(createPostDto.eventDateTime);
      if (isNaN(eventDateTime.getTime()) || eventDateTime <= new Date()) {
        throw new BadRequestException(
          'eventDateTime must be a valid date in the future',
        );
      }

      const {
        pollOptions: _p,
        pollExpiresAt: _pe,
        scheduledAt: _s,
        connectedSchoolIds,
        ...postData
      } = createPostDto;
      const post = await this.prisma.post.create({
        data: {
          ...postData,
          authorId,
          scheduledAt: scheduledAt ?? null,
          ...(connectedSchoolIds?.length
            ? { connectedSchools: { connect: connectedSchoolIds.map((id) => ({ id })) } }
            : {}),
        },
        include: { author: { select: POST_AUTHOR_SELECT } },
      });

      await this.invalidatePostListCaches();
      return formatPost(post);
    }

    if (createPostDto.postType === PostType.POLL) {
      if (!createPostDto.pollOptions || createPostDto.pollOptions.length < 2) {
        throw new BadRequestException(
          'Poll posts must have at least 2 options',
        );
      }
      if (!createPostDto.pollExpiresAt) {
        throw new BadRequestException(
          'Poll posts must specify an expiration date',
        );
      }
      const expiresAt = new Date(createPostDto.pollExpiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new BadRequestException(
          'Poll expiration date must be in the future',
        );
      }

      const {
        pollOptions,
        pollExpiresAt,
        scheduledAt: _,
        connectedSchoolIds,
        ...postData
      } = createPostDto;
      const post = await this.prisma.post.create({
        data: {
          ...postData,
          authorId,
          pollExpiresAt: expiresAt,
          scheduledAt: scheduledAt ?? null,
          pollOptions: {
            create: pollOptions.map((text) => ({ text })),
          },
          ...(connectedSchoolIds?.length
            ? { connectedSchools: { connect: connectedSchoolIds.map((id) => ({ id })) } }
            : {}),
        },
        include: {
          author: { select: POST_AUTHOR_SELECT },
          pollOptions: {
            include: {
              _count: { select: { votes: true } },
            },
          },
        },
      });

      await this.invalidatePostListCaches();
      return formatPost(post, authorId);
    }

    const {
      pollOptions: __,
      pollExpiresAt: ___,
      scheduledAt: ____,
      connectedSchoolIds,
      ...postData
    } = createPostDto;
    const post = await this.prisma.post.create({
      data: {
        ...postData,
        authorId,
        scheduledAt: scheduledAt ?? null,
        ...(connectedSchoolIds?.length
          ? { connectedSchools: { connect: connectedSchoolIds.map((id) => ({ id })) } }
          : {}),
      },
      include: { author: { select: POST_AUTHOR_SELECT } },
    });

    await this.invalidatePostListCaches();
    return formatPost(post);
  }

  async getFeed(userId: string, schoolId: string, page = 1, limit = 20) {
    const cacheKey = CK.feedBase(page, limit, schoolId);

    // Cache stores raw posts WITHOUT user-specific pollVotes.
    // All users see the same posts — only the voted option differs per user.
    type RawFeed = { total: number; posts: any[] };
    let raw = await this.cache.get<RawFeed>(cacheKey);

    if (!raw) {
      const skip = (page - 1) * limit;
      const where: any = {
        deletedAt: null,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
        AND: [
          {
            OR: [
              { schoolId },
              { connectedSchools: { some: { id: schoolId } } },
              { event: { schoolId: schoolId } },
              { event: { connectedSchools: { some: { id: schoolId } } } },
            ],
          },
        ],
      };
      const [total, posts] = await Promise.all([
        this.prisma.post.count({ where }),
        this.prisma.post.findMany({
          where,
          skip,
          take: limit,
          include: {
            author: { select: POST_AUTHOR_SELECT },
            _count: { select: { likes: true, comments: true } },
            pollOptions: { include: { _count: { select: { votes: true } } } },
            // pollVotes intentionally omitted — overlaid per-user below
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
      raw = { total, posts };
      await this.cache.set(cacheKey, raw, TTL.FEED_BASE);
    }

    // Overlay the requesting user's poll votes in one indexed query
    const allOptionIds = raw.posts.flatMap(
      (p) => p.pollOptions?.map((o: any) => o.id) ?? [],
    );
    const voteByPostId: Record<string, string> = {};
    if (allOptionIds.length > 0) {
      const votes = await this.prisma.pollVote.findMany({
        where: { userId, optionId: { in: allOptionIds } },
        select: { optionId: true },
      });
      const optionToPostId: Record<string, string> = {};
      raw.posts.forEach((p) =>
        p.pollOptions?.forEach((o: any) => {
          optionToPostId[o.id] = p.id;
        }),
      );
      votes.forEach((v) => {
        voteByPostId[optionToPostId[v.optionId]] = v.optionId;
      });
    }

    const postsWithVotes = raw.posts.map((p) => ({
      ...p,
      pollVotes: voteByPostId[p.id] ? [{ optionId: voteByPostId[p.id] }] : [],
    }));

    return {
      data: postsWithVotes.map((post) => formatPost(post, userId)),
      meta: {
        total: raw.total,
        page,
        limit,
        totalPages: Math.ceil(raw.total / limit),
      },
    };
  }

  async findAll(schoolId?: string, type?: string, userId?: string) {
    const cacheKey = CK.postsList({ schoolId, type });
    type RawList = { posts: any[] };
    let raw = await this.cache.get<RawList>(cacheKey);

    if (!raw) {
      const where: any = {
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      };
      if (schoolId) {
        where.AND = [
          {
            OR: [
              { schoolId },
              { connectedSchools: { some: { id: schoolId } } },
              { event: { schoolId: schoolId } },
              { event: { connectedSchools: { some: { id: schoolId } } } },
            ],
          },
        ];
      }
      if (type) where.postType = type;

      const posts = await this.prisma.post.findMany({
        where,
        include: {
          author: { select: POST_AUTHOR_SELECT },
          _count: { select: { likes: true, comments: true } },
          pollOptions: { include: { _count: { select: { votes: true } } } },
          // pollVotes intentionally omitted — overlaid per-user below
        },
        orderBy: { createdAt: 'desc' },
      });
      raw = { posts };
      await this.cache.set(cacheKey, raw, TTL.POSTS_LIST);
    }

    if (!userId) return raw.posts.map((post) => formatPost(post));

    // Overlay user's poll votes
    const allOptionIds = raw.posts.flatMap(
      (p) => p.pollOptions?.map((o: any) => o.id) ?? [],
    );
    const voteByPostId: Record<string, string> = {};
    if (allOptionIds.length > 0) {
      const votes = await this.prisma.pollVote.findMany({
        where: { userId, optionId: { in: allOptionIds } },
        select: { optionId: true },
      });
      const optionToPostId: Record<string, string> = {};
      raw.posts.forEach((p) =>
        p.pollOptions?.forEach((o: any) => {
          optionToPostId[o.id] = p.id;
        }),
      );
      votes.forEach((v) => {
        voteByPostId[optionToPostId[v.optionId]] = v.optionId;
      });
    }

    return raw.posts
      .map((p) => ({
        ...p,
        pollVotes: voteByPostId[p.id] ? [{ optionId: voteByPostId[p.id] }] : [],
      }))
      .map((post) => formatPost(post, userId));
  }

  async findOne(id: string, userId?: string) {
    let rawPost = await this.cache.get<any>(CK.postBase(id));

    if (!rawPost) {
      rawPost = await this.prisma.post.findUnique({
        where: { id },
        include: {
          author: { select: POST_AUTHOR_SELECT },
          _count: { select: { likes: true, comments: true } },
          pollOptions: { include: { _count: { select: { votes: true } } } },
          // pollVotes intentionally omitted — overlaid per-user below
        },
      });
      if (!rawPost) throw new NotFoundException(`Post with ID ${id} not found`);
      await this.cache.set(CK.postBase(id), rawPost, TTL.POST_BASE);
    }

    if (!userId) return formatPost(rawPost);

    // Overlay the requesting user's vote for this post
    const optionIds = rawPost.pollOptions?.map((o: any) => o.id) ?? [];
    let pollVotes: { optionId: string }[] = [];
    if (optionIds.length > 0) {
      const vote = await this.prisma.pollVote.findFirst({
        where: { userId, optionId: { in: optionIds } },
        select: { optionId: true },
      });
      if (vote) pollVotes = [{ optionId: vote.optionId }];
    }

    return formatPost({ ...rawPost, pollVotes }, userId);
  }

  async update(id: string, updatePostDto: UpdatePostDto, user: any) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        event: {
          include: { connectedSchools: { select: { id: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);

    const isSuperAdmin = user.role === 'TIKIT_ADMIN';
    const isSchoolAdmin = user.role === 'SCHOOL_ADMIN';

    const isEventHostSchool = post.event?.schoolId === user.schoolId;
    const isEventConnectedSchool = post.event?.connectedSchools.some(
      (s) => s.id === user.schoolId,
    );

    const hasAdminRights =
      isSuperAdmin ||
      (isSchoolAdmin &&
        (post.schoolId === user.schoolId ||
          isEventHostSchool ||
          isEventConnectedSchool));

    if (!hasAdminRights && post.authorId !== user.id) {
      throw new ForbiddenException(
        'You can only edit your own posts or posts in your school/event',
      );
    }

    const { pollOptions: _, pollExpiresAt: __, ...updateData } = updatePostDto;

    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: POST_AUTHOR_SELECT },
        pollOptions: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        pollVotes: {
          where: { userId: user.id },
          select: { optionId: true },
        },
      },
    });

    await this.invalidatePostCaches(id);
    return formatPost(updatedPost, user.id);
  }

  async remove(id: string, user: any) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        event: {
          include: { connectedSchools: { select: { id: true } } },
        },
      },
    });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);

    const isSuperAdmin = user.role === 'TIKIT_ADMIN';
    const isSchoolAdmin = user.role === 'SCHOOL_ADMIN';

    const isEventHostSchool = post.event?.schoolId === user.schoolId;
    const isEventConnectedSchool = post.event?.connectedSchools.some(
      (s) => s.id === user.schoolId,
    );

    const hasAdminRights =
      isSuperAdmin ||
      (isSchoolAdmin &&
        (post.schoolId === user.schoolId ||
          isEventHostSchool ||
          isEventConnectedSchool));

    if (!hasAdminRights && post.authorId !== user.id) {
      throw new ForbiddenException(
        'You can only delete your own posts or posts in your school/event',
      );
    }

    const result = await this.prisma.post.delete({ where: { id } });
    await this.invalidatePostCaches(id);
    return result;
  }

  async toggleLike(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with ID ${postId} not found`);

    const existing = await this.prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      await this.prisma.postLike.delete({
        where: { postId_userId: { postId, userId } },
      });
      // Bust single-post cache so _count.likes is fresh on next fetch
      await this.cache.del(CK.postBase(postId));
      return { liked: false };
    }

    await this.prisma.postLike.create({ data: { postId, userId } });
    await this.cache.del(CK.postBase(postId));
    return { liked: true };
  }

  async addComment(postId: string, userId: string, body: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with ID ${postId} not found`);

    const comment = await this.prisma.postComment.create({
      data: { postId, authorId: userId, body },
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
    // Bust single-post cache so _count.comments is fresh on next fetch
    await this.cache.del(CK.postBase(postId));
    return comment;
  }

  async getComments(postId: string) {
    return this.prisma.postComment.findMany({
      where: { postId },
      include: { author: { select: POST_AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteComment(commentId: string, user: any) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
      include: { post: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const isSuperAdmin = user.role === 'TIKIT_ADMIN';
    const isSchoolAdmin = user.role === 'SCHOOL_ADMIN';
    const hasAdminRights =
      isSuperAdmin ||
      (isSchoolAdmin && comment.post.schoolId === user.schoolId);

    if (!hasAdminRights && comment.authorId !== user.id) {
      throw new ForbiddenException(
        'You can only delete your own comments or comments in your school',
      );
    }

    return this.prisma.postComment.delete({ where: { id: commentId } });
  }

  async vote(postId: string, userId: string, optionId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        pollOptions: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.postType !== PostType.POLL) {
      throw new BadRequestException('This post is not a poll');
    }

    if (post.pollExpiresAt && new Date(post.pollExpiresAt) < new Date()) {
      throw new BadRequestException('This poll has expired');
    }

    const optionExists = post.pollOptions.some((opt) => opt.id === optionId);
    if (!optionExists) {
      throw new BadRequestException('Invalid poll option for this post');
    }

    const existingVote = await this.prisma.pollVote.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    if (existingVote) {
      throw new BadRequestException('You have already voted in this poll');
    }

    await this.prisma.pollVote.create({
      data: {
        postId,
        userId,
        optionId,
      },
    });

    // Vote changes poll counts — invalidate base post and all list/feed caches
    await this.invalidatePostCaches(postId);
    return this.findOne(postId, userId);
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────

  /** Bust only the list/feed caches (used on post creation). */
  private async invalidatePostListCaches() {
    await Promise.all([
      this.cache.delByPattern('feed:base:*'),
      this.cache.delByPattern('posts:list:*'),
    ]);
  }

  /** Bust the single-post cache plus all list/feed caches (used on edit/delete/vote). */
  private async invalidatePostCaches(id: string) {
    await Promise.all([
      this.cache.del(CK.postBase(id)),
      this.cache.delByPattern('feed:base:*'),
      this.cache.delByPattern('posts:list:*'),
    ]);
  }
}
