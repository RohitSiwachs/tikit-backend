import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateClassDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  className: string;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  graduationYear: number;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  studentCount?: number;
}
