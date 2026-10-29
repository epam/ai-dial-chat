import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';
import {
  CONVERSATION_PATH_VALIDATION_MESSAGE,
  IsConversationPath,
} from '../../common/validators/conversation-path.validator';

export class AttachGenerationDto {
  @ApiProperty({
    description:
      'Conversation sub-path (bucket-stripped), e.g. "gpt-4o__My Chat".',
    example: 'gpt-4o__My Chat',
  })
  @IsString()
  @MinLength(1)
  @IsConversationPath()
  @Matches(/^[^\\]*$/, { message: CONVERSATION_PATH_VALIDATION_MESSAGE })
  path!: string;
}
