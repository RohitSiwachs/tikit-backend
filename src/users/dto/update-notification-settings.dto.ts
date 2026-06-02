import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateNotificationSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifPush?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifEmail?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifSms?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifFriendRequests?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifNewPosts?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifEventInvites?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  notifTicketReceipts?: boolean;
}
