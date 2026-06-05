import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { PostType } from '../common';

const POST_AUTHOR_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
} as const;

function formatPost(post: any, userId?: string) {
  if (!post) return post;
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
  const userVotedOptionId =
    pollVotes.length > 0 ? pollVotes[0].optionId : null;

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
  constructor(private readonly prisma: PrismaService) {}

  async create(createPostDto: CreatePostDto, authorId: string) {
    if (createPostDto.postType === PostType.POLL) {
      if (!createPostDto.pollOptions || createPostDto.pollOptions.length < 2) {
        throw new BadRequestException('Poll posts must have at least 2 options');
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

      const { pollOptions, pollExpiresAt, ...postData } = createPostDto;
      const post = await this.prisma.post.create({
        data: {
          ...postData,
          authorId,
          pollExpiresAt: expiresAt,
          pollOptions: {
            create: pollOptions.map((text) => ({ text })),
          },
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

      return formatPost(post, authorId);
    }

    const { pollOptions: _, pollExpiresAt: __, ...postData } = createPostDto;
    const post = await this.prisma.post.create({
      data: { ...postData, authorId },
      include: { author: { select: POST_AUTHOR_SELECT } },
    });

    return formatPost(post);
  }

  async getFeed(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
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
          pollOptions: {
            include: {
              _count: { select: { votes: true } },
            },
          },
          pollVotes: {
            where: { userId },
            select: { optionId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: posts.map((post) => formatPost(post, userId)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(schoolId?: string, type?: string, userId?: string) {
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (type) where.postType = type;

    const posts = await this.prisma.post.findMany({
      where,
      include: {
        author: { select: POST_AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
        pollOptions: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        pollVotes: userId
          ? {
              where: { userId },
              select: { optionId: true },
            }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return posts.map((post) => formatPost(post, userId));
  }

  async findOne(id: string, userId?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: POST_AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
        pollOptions: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        pollVotes: userId
          ? {
              where: { userId },
              select: { optionId: true },
            }
          : false,
      },
    });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    return formatPost(post, userId);
  }

  async update(
    id: string,
    updatePostDto: UpdatePostDto,
    requestingUserId: string,
    isAdmin: boolean,
  ) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    if (!isAdmin && post.authorId !== requestingUserId) {
      throw new ForbiddenException('You can only edit your own posts');
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
          where: { userId: requestingUserId },
          select: { optionId: true },
        },
      },
    });

    return formatPost(updatedPost, requestingUserId);
  }

  async remove(id: string, requestingUserId: string, isAdmin: boolean) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    if (!isAdmin && post.authorId !== requestingUserId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    return this.prisma.post.delete({ where: { id } });
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
      return { liked: false };
    }

    await this.prisma.postLike.create({ data: { postId, userId } });
    return { liked: true };
  }

  async addComment(postId: string, userId: string, body: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with ID ${postId} not found`);

    return this.prisma.postComment.create({
      data: { postId, authorId: userId, body },
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
  }

  async getComments(postId: string) {
    return this.prisma.postComment.findMany({
      where: { postId },
      include: { author: { select: POST_AUTHOR_SELECT } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteComment(
    commentId: string,
    requestingUserId: string,
    isAdmin: boolean,
  ) {
    const comment = await this.prisma.postComment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (!isAdmin && comment.authorId !== requestingUserId) {
      throw new ForbiddenException('You can only delete your own comments');
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

    return this.findOne(postId, userId);
  }
}
