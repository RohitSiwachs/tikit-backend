import { Controller, Post, Body, UseGuards, Get, Param } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';

@ApiTags('scanner')
@ApiBearerAuth()
@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('scan')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
  @ApiOperation({ summary: 'Scan or verify a QR code for a ticket or card' })
  scan(@Body('qrToken') qrToken: string, @Body('verifyOnly') verifyOnly?: boolean) {
    return this.scannerService.scan(qrToken, !!verifyOnly);
  }

  @Get('events/:eventId/stats')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
  @ApiOperation({ summary: 'Get scan/attendance stats for an event' })
  getStats(@Param('eventId') eventId: string) {
    return this.scannerService.getEventStats(eventId);
  }
}
