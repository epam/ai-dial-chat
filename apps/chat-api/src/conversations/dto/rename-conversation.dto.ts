import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { MaxUtf8ByteLength } from './max-utf8-byte-length.validator';

export class RenameConversationBodyDto {
  @ApiProperty({
    description: 'New title for the conversation',
    example: 'My renamed chat',
  })
  @IsString()
  @MinLength(1)
  @MaxUtf8ByteLength(255)
  newTitle!: string;
}

export class RenameConversationResponseDto {
  @ApiProperty({
    description: 'New relative path of the renamed conversation',
    example: 'conversations/bucket/gpt-4o__My renamed chat__uuid',
  })
  newPath!: string;
}
