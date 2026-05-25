import { Controller, Get, Post, Body, Param, Query, Request } from '@nestjs/common';
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto, RedeemVoucherDto } from './dto/voucher.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('vouchers')
@ApiBearerAuth()
@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Create a voucher code for an event' })
  create(@Body() dto: CreateVoucherDto, @Request() req: any) {
    return this.vouchersService.create(dto, req.user.id);
  }

  @Post('redeem')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.STUDENT)
  @ApiOperation({ summary: 'Redeem a voucher code for a ticket' })
  redeem(@Body() dto: RedeemVoucherDto, @Request() req: any) {
    return this.vouchersService.redeem(dto, req.user.id);
  }

  @Get()
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'List all vouchers (optionally filtered by event)' })
  findAll(@Query('eventId') eventId?: string) {
    return this.vouchersService.findAll(eventId);
  }

  @Get(':id')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE)
  @ApiOperation({ summary: 'Get voucher details' })
  findOne(@Param('id') id: string) {
    return this.vouchersService.findOne(id);
  }
}
