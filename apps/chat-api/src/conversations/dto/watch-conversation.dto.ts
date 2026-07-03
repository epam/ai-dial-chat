import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class WatchConversationBodyDto {
  @ApiProperty({
    description:
      'Conversation sub-path (bucket-stripped), e.g. "gpt-4o__My Chat".',
    example: 'gpt-4o__My Chat',
  })
  @IsString()
  @MinLength(1)
  @Matches(/^(?!.*\.\.)(?!.*\\)[\s\S]+$/, {
    message: 'path contains invalid characters',
  })
  path!: string;
}
