import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoucherDto {
  @ApiProperty() @IsString() @IsNotEmpty() eventId: string;
  @ApiProperty() @IsString() @IsNotEmpty() ticketTypeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedToId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}

export class RedeemVoucherDto {
  @ApiProperty() @IsString() @IsNotEmpty() code: string;
}
