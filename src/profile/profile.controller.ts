import { Controller, Get, Post, Delete, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProfileService } from './profile.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('api/v1')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('users/me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.profileService.getProfile(user.id);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user profile by ID' })
  getUser(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Get('users/:id/followers')
  @ApiOperation({ summary: 'Get followers (Följare list)' })
  getFollowers(
    @Param('id') id: string,
    @Query('search') search: string,
    @Query('page') page: string,
  ) {
    return this.profileService.getFollowers(id, search, page ? parseInt(page) : 1);
  }

  @Get('users/:id/following')
  @ApiOperation({ summary: 'Get following (Följer list)' })
  getFollowing(
    @Param('id') id: string,
    @Query('search') search: string,
    @Query('page') page: string,
  ) {
    return this.profileService.getFollowing(id, search, page ? parseInt(page) : 1);
  }

  @Post('users/:id/follow')
  @ApiOperation({ summary: 'Follow a user' })
  follow(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.profileService.followUser(user.id, id);
  }

  @Delete('users/:id/follow')
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.profileService.unfollowUser(user.id, id);
  }

  @Get('users/suggestions')
  @ApiOperation({ summary: 'Get follow suggestions (Förslag för dig)' })
  getSuggestions(@CurrentUser() user: { id: string }) {
    return this.profileService.getSuggestions(user.id);
  }
}
