import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkCreateSchoolItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() name: string;
  @ApiProperty() @IsString() @IsNotEmpty() slug: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class BulkCreateSchoolsDto {
  @ApiProperty({ type: [BulkCreateSchoolItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkCreateSchoolItemDto)
  schools: BulkCreateSchoolItemDto[];
}
