import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Create a new campaign' })
  create(@Body() createCampaignDto: CreateCampaignDto, @Request() req: any) {
    return this.campaignsService.create(createCampaignDto, req.user);
  }

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'List all campaigns' })
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Update a campaign' })
  update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Delete a campaign' })
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Post(':id/send')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Trigger a manual send of a campaign' })
  triggerSend(@Param('id') id: string, @Request() req: any) {
    return this.campaignsService.triggerSend(id, req.user);
  }

  @Get(':id/report')
  @Roles(Role.TIKIT_ADMIN, Role.SCHOOL_ADMIN)
  @ApiOperation({ summary: 'Get campaign analytics report' })
  getReport(@Param('id') id: string) {
    return this.campaignsService.getReport(id);
  }
}
