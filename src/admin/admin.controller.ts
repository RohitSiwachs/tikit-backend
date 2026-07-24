import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';
import { UpdateCommunicationAllocationDto } from '../communication/dto/communication.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  // ─── Communication Usage ──────────────────────────────────────────────────

  @Get('communication-usage')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Get communication token usage for all schools' })
  getAllCommunicationUsage() {
    return this.adminService.getAllCommunicationUsage();
  }

  @Get('schools/:id/communication-usage')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get communication usage for a single school' })
  getSchoolCommunicationUsage(
    @Param('id') schoolId: string,
    @Request() req: any,
  ) {
    if (req.user.role !== Role.TIKIT_ADMIN && req.user.schoolId !== schoolId) {
      throw new ForbiddenException("You can only view your own school's usage");
    }
    return this.adminService.getSchoolCommunicationUsage(schoolId);
  }

  @Patch('schools/:id/communication-allocation')
  @Roles(Role.TIKIT_ADMIN)
  @ApiOperation({ summary: 'Set communication quota allocations for a school' })
  updateCommunicationAllocation(
    @Param('id') schoolId: string,
    @Body() dto: UpdateCommunicationAllocationDto,
  ) {
    return this.adminService.updateCommunicationAllocation(schoolId, dto);
  }
}
