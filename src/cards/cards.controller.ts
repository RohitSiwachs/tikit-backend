import { Controller, Get, Post, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CreateCardDto, GenerateCodesDto, UpdateCardDto } from './dto/card.dto';
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
}
