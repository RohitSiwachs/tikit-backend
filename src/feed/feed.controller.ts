import { Controller, Get, Post, Delete, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeedService } from './feed.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { UserRole } from '../common/enums.js';

@ApiTags('Feed')
@ApiBearerAuth()
@Controller('api/v1')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get('feed')
  @ApiOperation({ summary: 'Get feed (EVENT | FLÖDE tabs)' })
  getFeed(
    @Query('tab') tab: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.feedService.getFeed(
      { tab, page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20 },
      user.id,
    );
  }

  @Post('feed/posts')
  @Roles(UserRole.KAR_ADMIN, UserRole.EVENTANSVARIG, UserRole.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Create a feed post (admin)' })
  createPost(
    @Body() body: { content?: string; image_url?: string; event_id?: string; post_type?: string },
    @CurrentUser() user: { id: string; school_id: string },
  ) {
    return this.feedService.createPost(body, user.id, user.school_id);
  }

  @Post('feed/posts/:id/like')
  @ApiOperation({ summary: 'Like a post' })
  likePost(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.feedService.likePost(id, user.id);
  }

  @Delete('feed/posts/:id/like')
  @ApiOperation({ summary: 'Unlike a post' })
  unlikePost(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.feedService.unlikePost(id, user.id);
  }

  @Get('posts/:postId/comments')
  @ApiOperation({ summary: 'Get comments for a post (Kommentarer)' })
  getComments(
    @Param('postId') postId: string,
    @Query('page') page: string,
  ) {
    return this.feedService.getComments(postId, page ? parseInt(page) : 1);
  }

  @Post('posts/:postId/comments')
  @ApiOperation({ summary: 'Add a comment' })
  addComment(
    @Param('postId') postId: string,
    @Body() body: { content: string; parent_id?: string; mentioned_user_id?: string },
    @CurrentUser() user: { id: string },
  ) {
    return this.feedService.addComment(postId, body, user.id);
  }

  @Post('polls/:pollId/vote')
  @ApiOperation({ summary: 'Vote on a poll' })
  votePoll(
    @Param('pollId') pollId: string,
    @Body('option_id') optionId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.feedService.votePoll(pollId, optionId, user.id);
  }
}
