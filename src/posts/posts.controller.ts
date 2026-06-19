import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

const ADMIN_ROLES = [Role.TIKIT_ADMIN, Role.KARORDFORANDE] as const;

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Create a new post' })
  create(@Body() createPostDto: CreatePostDto, @Request() req: any) {
    return this.postsService.create(createPostDto, req.user.id);
  }

  @Get('feed')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.STUDENT)
  @ApiOperation({
    summary:
      'Personalized feed — posts from own school + schools of events attended',
  })
  getFeed(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.getFeed(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List posts with optional filters' })
  findAll(
    @Query('schoolId') schoolId?: string,
    @Query('type') type?: string,
    @Request() req?: any,
  ) {
    return this.postsService.findAll(schoolId, type, req.user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post details' })
  findOne(@Param('id') id: string, @Request() req?: any) {
    return this.postsService.findOne(id, req.user?.id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update a post (owner or admin only)' })
  update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: any,
  ) {
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    return this.postsService.update(id, updatePostDto, req.user.id, isAdmin);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete a post (owner or admin only)' })
  remove(@Param('id') id: string, @Request() req: any) {
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    return this.postsService.remove(id, req.user.id, isAdmin);
  }

  @Post(':id/like')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Toggle like on a post' })
  toggleLike(@Param('id') id: string, @Request() req: any) {
    return this.postsService.toggleLike(id, req.user.id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a post' })
  getComments(@Param('id') id: string) {
    return this.postsService.getComments(id);
  }

  @Post(':id/comments')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Add a comment to a post' })
  addComment(
    @Param('id') id: string,
    @Body('body') body: string,
    @Request() req: any,
  ) {
    return this.postsService.addComment(id, req.user.id, body);
  }

  @Delete('comments/:commentId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Delete a comment (owner or admin only)' })
  deleteComment(@Param('commentId') commentId: string, @Request() req: any) {
    const isAdmin = ADMIN_ROLES.includes(req.user.role);
    return this.postsService.deleteComment(commentId, req.user.id, isAdmin);
  }

  @Post(':id/vote')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.STUDENT)
  @ApiOperation({ summary: 'Vote on a poll post' })
  vote(
    @Param('id') id: string,
    @Body('optionId') optionId: string,
    @Request() req: any,
  ) {
    return this.postsService.vote(id, req.user.id, optionId);
  }
}
