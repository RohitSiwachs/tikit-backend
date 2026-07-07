import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../prisma-enums';
import { ScanDto } from './dto/scan.dto';

@ApiTags('scanner')
@ApiBearerAuth()
@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post('scan')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
  @ApiOperation({
    summary: 'Scan or verify a QR code for a ticket or card',
    description:
      'Pass a QR token (prefixed with "qr_") to scan a ticket, or a plain card code to scan a card. ' +
      'Set verifyOnly to true to check validity without performing a check-in.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Scan successful — returns ticket or card details with status.',
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'TICKET' },
            message: { type: 'string', example: 'Check-in successful' },
            isCheckedIn: { type: 'boolean', example: true },
            checkedInAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            ticket: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                code: { type: 'string' },
                status: { type: 'string', example: 'CHECKED_IN' },
              },
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                displayName: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                email: { type: 'string' },
                avatarUrl: { type: 'string', nullable: true },
                age: { type: 'number', nullable: true },
              },
            },
            event: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
            ticketType: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Standard' },
              },
            },
            stats: {
              type: 'object',
              properties: {
                scannedCount: { type: 'number' },
                remainingEntries: { type: 'number' },
                totalCapacity: { type: 'number' },
                occupancyRate: { type: 'number' },
              },
            },
          },
        },
        {
          type: 'object',
          properties: {
            type: { type: 'string', example: 'CARD' },
            message: {
              type: 'string',
              example: 'Card code is valid and ready to be activated',
            },
            cardTitle: { type: 'string' },
            cardBenefits: { type: 'string', nullable: true },
            validUntil: { type: 'string', format: 'date-time' },
            isActivated: { type: 'boolean' },
            activatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
            user: { type: 'object', nullable: true },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request — QR token missing, ticket already checked in, event cancelled/ended, ticket voided, or card blocked/paused/expired.',
  })
  @ApiResponse({ status: 404, description: 'QR token or card code not found.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid JWT.',
  })
  scan(@Body() dto: ScanDto) {
    return this.scannerService.scan(dto.qrToken, !!dto.verifyOnly);
  }

  @Get('events/:eventId/stats')
  @Roles(Role.TIKIT_ADMIN, Role.KARORDFORANDE, Role.EVENTANSVARIG, Role.SCANNER)
  @ApiOperation({
    summary: 'Get scan/attendance stats for an event',
    description:
      'Returns the total ticket count, checked-in count, remaining entries, and occupancy rate for the given event.',
  })
  @ApiParam({
    name: 'eventId',
    description: 'UUID of the event',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Event scan statistics.',
    schema: {
      type: 'object',
      properties: {
        scannedCount: {
          type: 'number',
          description: 'Number of tickets already checked in',
        },
        remainingEntries: {
          type: 'number',
          description: 'Tickets still waiting to be scanned',
        },
        totalCapacity: {
          type: 'number',
          description: 'Total non-voided tickets',
        },
        occupancyRate: {
          type: 'number',
          description: 'Percentage of checked-in tickets (0–100)',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid JWT.',
  })
  getStats(@Param('eventId') eventId: string) {
    return this.scannerService.getEventStats(eventId);
  }
}
