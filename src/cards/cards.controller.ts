import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  Request,
} from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto, GenerateCodesDto, UpdateCardDto } from './dto/card.dto';
import { ClaimCardDto } from './dto/claim-card.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('cards')
@ApiBearerAuth()
@Controller('cards')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Create card template' })
  create(@Body() dto: CreateCardDto) {
    return this.cardsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all card templates' })
  findAll(@Query('schoolId') schoolId?: string) {
    return this.cardsService.findAll(schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get card details' })
  findOne(@Param('id') id: string) {
    return this.cardsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Update card template' })
  update(@Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.cardsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Delete a card template' })
  remove(@Param('id') id: string) {
    return this.cardsService.remove(id);
  }

  @Post(':id/generate-codes')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Generate unique codes for a card' })
  generateCodes(@Param('id') id: string, @Body() dto: GenerateCodesDto) {
    return this.cardsService.generateCodes(id, dto.count);
  }

  @Post(':id/duplicate')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Duplicate a card template as a draft' })
  duplicateCard(@Param('id') id: string) {
    return this.cardsService.duplicateCard(id);
  }

  @Get(':id/export')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Export generated codes for a card' })
  exportCodes(@Param('id') id: string) {
    return this.cardsService.exportCodes(id);
  }

  @Patch(':id/pause')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Pause a card' })
  pauseCard(@Param('id') id: string) {
    return this.cardsService.pauseCard(id);
  }

  @Patch(':id/block')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Block a card' })
  blockCard(@Param('id') id: string) {
    return this.cardsService.blockCard(id);
  }

  @Get(':id/students')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'View students who activated the card' })
  getActivatedStudents(@Param('id') id: string) {
    return this.cardsService.getActivatedStudents(id);
  }

  @Get(':id/assigned-users')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'View all users assigned this card (activated or pending)' })
  getAssignedUsers(@Param('id') id: string) {
    return this.cardsService.getAssignedUsers(id);
  }

  @Post('claim')
  @Roles(Role.STUDENT, Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({
    summary: 'Claim and activate student card using a card code',
  })
  claimCard(@Request() req: any, @Body() dto: ClaimCardDto) {
    return this.cardsService.claimCard(req.user.id, dto.code);
  }
}
