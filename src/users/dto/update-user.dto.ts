import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../prisma-enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ['TIKIT_ADMIN', 'KARORDFORANDE', 'STUDENT'] })
  @IsEnum(Role)
  role: Role;
}

export class UpdateUserApprovalDto {
  @ApiProperty({ enum: ['approved', 'pending', 'rejected'] })
  @IsString()
  status: string;
}
