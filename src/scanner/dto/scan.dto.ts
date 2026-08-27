import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanDto {
  @ApiProperty({
    description:
      'The QR token or card code to scan. Tokens prefixed with "qr_" are treated as tickets; all others as card codes.',
    example: 'qr_abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  qrToken: string;

  @ApiProperty({
    description:
      'If true, only verifies the ticket validity without performing a check-in. Defaults to false.',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  verifyOnly?: boolean;
}
