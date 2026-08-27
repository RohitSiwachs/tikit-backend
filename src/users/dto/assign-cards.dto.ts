import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class AssignCardsToUsersDto {
  @ApiProperty({ description: 'The UUID of the card to assign' })
  @IsString()
  cardId: string;

  @ApiProperty({
    description: 'List of user UUIDs to assign the card to',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  userIds: string[];
}
