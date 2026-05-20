import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConversationPathDto {
  @ApiProperty({
    description: 'Conversation path (uuid__name). May contain slashes.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8__My Conversation 5/19/2026',
  })
  @IsString()
  @MinLength(1)
  path!: string;
}
