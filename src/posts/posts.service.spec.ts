import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostType } from '../common';

const mockPrisma = {
  post: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  postLike: { create: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
  postComment: { create: jest.fn(), findMany: jest.fn() },
  ticket: { findMany: jest.fn() },
  pollVote: { create: jest.fn(), findUnique: jest.fn() },
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a standard text post', async () => {
      const dto = {
        body: 'Hello world',
        postType: PostType.TEXT,
        schoolId: 'school-1',
        authorId: 'author-1',
      };

      mockPrisma.post.create.mockResolvedValue({
        id: 'post-1',
        ...dto,
        author: { id: 'author-1', displayName: 'John' },
      });

      const result = await service.create(dto, 'author-1');
      expect(result.body).toBe('Hello world');
      expect(result.postType).toBe(PostType.TEXT);
      expect(mockPrisma.post.create).toHaveBeenCalledWith({
        data: {
          body: dto.body,
          postType: dto.postType,
          schoolId: dto.schoolId,
          authorId: dto.authorId,
          scheduledAt: null,
        },
        include: { author: { select: expect.any(Object) } },
      });
    });

    it('should throw BadRequestException if poll has less than 2 options', async () => {
      const dto = {
        body: 'Who will win?',
        postType: PostType.POLL,
        schoolId: 'school-1',
        authorId: 'author-1',
        pollOptions: ['Option A'],
        pollExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      await expect(service.create(dto, 'author-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if poll expires in the past', async () => {
      const dto = {
        body: 'Who will win?',
        postType: PostType.POLL,
        schoolId: 'school-1',
        authorId: 'author-1',
        pollOptions: ['Option A', 'Option B'],
        pollExpiresAt: new Date(Date.now() - 86400000).toISOString(),
      };

      await expect(service.create(dto, 'author-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a poll post with options', async () => {
      const dto = {
        body: 'Who will win?',
        postType: PostType.POLL,
        schoolId: 'school-1',
        authorId: 'author-1',
        pollOptions: ['Option A', 'Option B'],
        pollExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      mockPrisma.post.create.mockResolvedValue({
        id: 'post-poll-1',
        body: dto.body,
        postType: dto.postType,
        schoolId: dto.schoolId,
        authorId: dto.authorId,
        pollExpiresAt: new Date(dto.pollExpiresAt),
        author: { id: 'author-1', displayName: 'John' },
        pollOptions: [
          { id: 'opt-a', text: 'Option A', _count: { votes: 0 } },
          { id: 'opt-b', text: 'Option B', _count: { votes: 0 } },
        ],
        pollVotes: [],
      });

      const result = await service.create(dto, 'author-1');
      expect(result.poll).toBeDefined();
      expect(result.poll.options).toHaveLength(2);
      expect(result.poll.totalVotes).toBe(0);
    });
  });

  describe('vote', () => {
    it('should record a vote and return updated post', async () => {
      const post = {
        id: 'post-poll-1',
        body: 'Who will win?',
        postType: PostType.POLL,
        pollExpiresAt: new Date(Date.now() + 86400000),
        pollOptions: [
          { id: 'opt-a', text: 'Option A' },
          { id: 'opt-b', text: 'Option B' },
        ],
      };

      mockPrisma.post.findUnique.mockResolvedValue(post);
      mockPrisma.pollVote.findUnique.mockResolvedValue(null);
      mockPrisma.pollVote.create.mockResolvedValue({
        id: 'vote-1',
        postId: 'post-poll-1',
        userId: 'user-1',
        optionId: 'opt-a',
      });

      // Mock the findOne return after vote
      const updatedPost = {
        ...post,
        author: { id: 'author-1', displayName: 'John' },
        pollOptions: [
          { id: 'opt-a', text: 'Option A', _count: { votes: 1 } },
          { id: 'opt-b', text: 'Option B', _count: { votes: 0 } },
        ],
        pollVotes: [{ optionId: 'opt-a' }],
      };
      jest.spyOn(service, 'findOne').mockResolvedValue(updatedPost as any);

      const result = await service.vote('post-poll-1', 'user-1', 'opt-a');
      expect(mockPrisma.pollVote.create).toHaveBeenCalledWith({
        data: {
          postId: 'post-poll-1',
          userId: 'user-1',
          optionId: 'opt-a',
        },
      });
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if user already voted', async () => {
      const post = {
        id: 'post-poll-1',
        body: 'Who will win?',
        postType: PostType.POLL,
        pollExpiresAt: new Date(Date.now() + 86400000),
        pollOptions: [
          { id: 'opt-a', text: 'Option A' },
          { id: 'opt-b', text: 'Option B' },
        ],
      };

      mockPrisma.post.findUnique.mockResolvedValue(post);
      mockPrisma.pollVote.findUnique.mockResolvedValue({ id: 'existing-vote' });

      await expect(
        service.vote('post-poll-1', 'user-1', 'opt-a'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if poll is expired', async () => {
      const post = {
        id: 'post-poll-1',
        body: 'Who will win?',
        postType: PostType.POLL,
        pollExpiresAt: new Date(Date.now() - 86400000), // past
        pollOptions: [
          { id: 'opt-a', text: 'Option A' },
          { id: 'opt-b', text: 'Option B' },
        ],
      };

      mockPrisma.post.findUnique.mockResolvedValue(post);

      await expect(
        service.vote('post-poll-1', 'user-1', 'opt-a'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
