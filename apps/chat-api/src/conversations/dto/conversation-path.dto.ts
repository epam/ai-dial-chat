import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConversationPathDto {
  @ApiProperty({
    description: 'Conversation path (uuid__name). May contain slashes.',
    example: 'gpt-4o__My Conversation__UUID',
  })
  @IsString()
  @MinLength(1)
  path!: string;
}
