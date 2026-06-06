import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimTicketDto {
  @ApiProperty({ description: 'ID of the event to claim a ticket for' })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ description: 'ID of the ticket type to claim' })
  @IsString()
  @IsNotEmpty()
  ticketTypeId: string;
}
