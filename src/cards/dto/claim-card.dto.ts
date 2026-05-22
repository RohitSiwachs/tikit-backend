import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimCardDto {
  @ApiProperty()
  @IsString()
  code: string;
}
