import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateClassDto {
  @ApiProperty({ description: 'The name of the class (e.g. NA24)' })
  @IsString()
  @IsNotEmpty()
  className: string;

  @ApiProperty({ description: 'Graduation year of the class (e.g. 2027)' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  graduationYear: number;
}

export class UpdateClassDto extends PartialType(CreateClassDto) {}
