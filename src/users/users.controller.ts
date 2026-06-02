import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UpdateUserRoleDto,
  UpdateUserApprovalDto,
} from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';
import { AssignCardsToUsersDto } from './dto/assign-cards.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'List all users with filters' })
  findAll(
    @Query('role') role?: string,
    @Query('schoolId') schoolId?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('className') className?: string,
    @Query('year') year?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll({
      role: role as Role,
      schoolId,
      approvalStatus,
      className,
      year: year ? parseInt(year) : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  @Post('assign-cards')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Assign a card to multiple specific students' })
  @ApiBody({ type: AssignCardsToUsersDto })
  assignCards(@Body() body: AssignCardsToUsersDto) {
    return this.usersService.assignCards(body.cardId, body.userIds);
  }

  @Get(':id/engagement')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'View activation and engagement data for a student' })
  getEngagement(@Param('id') id: string) {
    return this.usersService.getEngagementData(id);
  }

  @Patch(':id/role')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto.role);
  }

  @Patch(':id/approval')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Approve or Reject user' })
  updateApproval(@Param('id') id: string, @Body() dto: UpdateUserApprovalDto) {
    return this.usersService.updateApproval(id, dto.status);
  }

  @Get(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get user details' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Activate or deactivate user account' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.usersService.updateStatus(id, status);
  }

  @Get('profile/:username')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Get user profile by username' })
  getProfile(
    @Param('username') username: string,
    @Request() req: any,
  ) {
    return this.usersService.getProfile(username, req.user.id);
  }

  @Post(':id/follow')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Send a follow request' })
  followUser(
    @Param('id') targetUserId: string,
    @Request() req: any,
  ) {
    return this.usersService.requestFollow(req.user.id, targetUserId);
  }

  @Delete(':id/follow')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollowUser(
    @Param('id') targetUserId: string,
    @Request() req: any,
  ) {
    return this.usersService.unfollow(req.user.id, targetUserId);
  }

  @Get('me/follow-requests')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'List incoming pending follow requests for the logged-in user' })
  getFollowRequests(@Request() req: any) {
    return this.usersService.getIncomingFollowRequests(req.user.id);
  }

  @Patch('follow-requests/:requestId')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Respond to a follow request' })
  respondToFollowRequest(
    @Param('requestId') requestId: string,
    @Body('status') status: string,
    @Request() req: any,
  ) {
    return this.usersService.respondToFollowRequest(req.user.id, requestId, status);
  }

  @Patch('notification-settings')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Update notification preferences for the logged-in user' })
  updateNotificationSettings(
    @Request() req: any,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.usersService.updateNotificationSettings(req.user.id, dto);
  }

  @Patch('profile')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Update profile information for the logged-in user' })
  updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Delete a user' })
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}

