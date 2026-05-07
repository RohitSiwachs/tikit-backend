import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { UserRole } from '../../common/enums.js';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  first_name: string;

  @IsString()
  @MinLength(2)
  last_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Födelsedatum — ÅÅÅÅ-MM-DD */
  @IsOptional()
  @IsDateString()
  birth_date?: string;

  /** Årskurs dropdown (1-3) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  school_year?: number;

  /** Klass dropdown (e.g. "NA2B") */
  @IsOptional()
  @IsString()
  class_name?: string;

  /** 8-character school code — required to associate user with a school */
  @IsString()
  @MinLength(8)
  school_code: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
