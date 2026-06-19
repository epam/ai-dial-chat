import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const rateValues = [1, -1] as const;

/** User thumbs-up / thumbs-down rating sent to DIAL Core. */
export enum MessageRating {
  Like = 1,
  Dislike = -1,
}

export class RateMessageDto {
  @ApiProperty({
    description: 'Identifier of the conversation being rated',
    example: 'bucket/gpt-4o__My Conversation__UUID',
  })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({
    description: 'Identifier of the assistant response message being rated',
    example: '22222222-2222-2222-2222-222222222222',
  })
  @IsString()
  @IsNotEmpty()
  responseId!: string;

  @ApiProperty({
    description: 'Model deployment ID that produced the response',
    example: 'anthropic.claude-v3-sonnet',
  })
  @IsString()
  @IsNotEmpty()
  modelId!: string;

  @ApiProperty({
    description:
      'Rating value — 1 (like/thumbs-up) or -1 (dislike/thumbs-down). DIAL Core adds this value to the message like count.',
    enum: rateValues,
  })
  @IsIn(rateValues)
  rate!: MessageRating;

  @ApiPropertyOptional({
    description: 'Optional free-text comment from the user',
    example: 'The response was too brief',
  })
  @IsString()
  @IsOptional()
  comment?: string;
}
