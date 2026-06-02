import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, ValidateNested, IsEmail, IsNumber, ArrayNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class StudentUploadItemDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  displayName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  className?: string;
}

export class UploadStudentsDto {
  @ApiProperty({ type: [StudentUploadItemDto], description: 'List of students to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentUploadItemDto)
  students: StudentUploadItemDto[];
}

export class ClassUploadItemDto {
  @ApiProperty()
  @IsString()
  className: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  graduationYear?: number;
}

export class UploadClassesDto {
  @ApiProperty({ type: [ClassUploadItemDto], description: 'List of classes to upload' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClassUploadItemDto)
  classes: ClassUploadItemDto[];
}

export class AssignCardsToSchoolDto {
  @ApiProperty({ description: 'The UUID of the card to assign' })
  @IsString()
  cardId: string;

  @ApiProperty({ type: [String], description: 'List of class names to assign the card to' })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  classNames: string[];
}
