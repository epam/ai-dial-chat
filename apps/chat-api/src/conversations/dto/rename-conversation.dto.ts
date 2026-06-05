import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RenameConversationBodyDto {
  @ApiProperty({
    description: 'New title for the conversation',
    example: 'My renamed chat',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  newTitle!: string;
}

export class RenameConversationResponseDto {
  @ApiProperty({
    description: 'New relative path of the renamed conversation',
    example: 'conversations/bucket/gpt-4o__My renamed chat__uuid',
  })
  newPath!: string;
}
