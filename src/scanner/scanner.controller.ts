import { Controller, Post, Body, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Scan a QR code for a ticket or a card' })
  scan(@Body('qrToken') qrToken: string) {
    return this.scannerService.scan(qrToken);
  }
}
