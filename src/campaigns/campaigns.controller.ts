import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
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
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Create a new campaign' })
  create(@Body() createCampaignDto: CreateCampaignDto) {
    return this.campaignsService.create(createCampaignDto);
  }

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'List all campaigns' })
  findAll() {
    return this.campaignsService.findAll();
  }

  @Get(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get campaign details' })
  findOne(@Param('id') id: string) {
    return this.campaignsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update a campaign' })
  update(@Param('id') id: string, @Body() updateCampaignDto: UpdateCampaignDto) {
    return this.campaignsService.update(id, updateCampaignDto);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete a campaign' })
  remove(@Param('id') id: string) {
    return this.campaignsService.remove(id);
  }

  @Post(':id/send')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Trigger a manual send of a campaign' })
  triggerSend(@Param('id') id: string) {
    return this.campaignsService.triggerSend(id);
  }

  @Get(':id/report')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get campaign analytics report' })
  getReport(@Param('id') id: string) {
    return this.campaignsService.getReport(id);
  }
}
