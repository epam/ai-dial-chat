import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { LIST_DISPLAY_NAME_READ_BATCH_SIZE } from '../constants/conversation.constants';
import {
  CONVERSATION_RESOURCE_ID_MAX_LENGTH,
  CONVERSATION_RESOURCE_ID_PATTERN,
  parseConversationResourceId,
} from '../utils/conversation-resource-id';

export class ConversationTitlesBodyDto {
  @ApiProperty({
    description:
      'Full DIAL Core conversation resource URLs. Duplicate IDs are read once. Missing or inaccessible conversations are omitted.',
    type: [String],
    minItems: 1,
    maxItems: LIST_DISPLAY_NAME_READ_BATCH_SIZE,
    example: ['conversations/default-bucket/gpt-4o__My%20chat'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIST_DISPLAY_NAME_READ_BATCH_SIZE)
  @IsString({ each: true })
  @MaxLength(CONVERSATION_RESOURCE_ID_MAX_LENGTH, { each: true })
  @Matches(CONVERSATION_RESOURCE_ID_PATTERN, { each: true })
  @ValidateBy(
    {
      name: 'conversationResourceId',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          parseConversationResourceId(value) != null,
        defaultMessage: () =>
          'Each id must be a full conversation resource URL without traversal or control characters',
      },
    },
    { each: true },
  )
  ids!: string[];
}

export class ConversationTitleDto {
  @ApiProperty({
    description: 'The exact conversation resource URL supplied in the request.',
    example: 'conversations/default-bucket/gpt-4o__My%20chat',
  })
  id!: string;

  @ApiProperty({
    description: 'Current display title without conversation messages.',
    example: 'My renamed chat',
  })
  title!: string;
}

export class ConversationTitlesResponseDto {
  @ApiProperty({ type: [ConversationTitleDto] })
  items!: ConversationTitleDto[];
}
