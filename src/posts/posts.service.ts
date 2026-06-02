import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';

const POST_AUTHOR_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPostDto: CreatePostDto, authorId: string) {
    return this.prisma.post.create({
      data: { ...createPostDto, authorId },
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
  }

  async getFeed(userId: string, schoolId: string | null, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Feed = user's own school posts + schools of events the user has tickets to
    const schoolIds = new Set<string>();
    if (schoolId) schoolIds.add(schoolId);

    const userTickets = await this.prisma.ticket.findMany({
      where: { userId },
      select: { event: { select: { schoolId: true } } },
    });
    userTickets.forEach((t) => schoolIds.add(t.event.schoolId));

    const where: any = {
      schoolId: { in: [...schoolIds] },
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
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      data: posts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findAll(schoolId?: string, type?: string) {
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    if (type) where.postType = type;

    return this.prisma.post.findMany({
      where,
      include: {
        author: { select: POST_AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: POST_AUTHOR_SELECT },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!post) throw new NotFoundException(`Post with ID ${id} not found`);
    return post;
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

    return this.prisma.post.update({
      where: { id },
      data: updatePostDto,
      include: { author: { select: POST_AUTHOR_SELECT } },
    });
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
}
