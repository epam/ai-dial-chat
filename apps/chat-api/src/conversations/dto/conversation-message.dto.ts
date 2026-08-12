import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MessageCustomContentDto } from './message-custom-content.dto';

export enum ConversationMessageRole {
  User = 'user',
  Assistant = 'assistant',
  Status = 'status',
}

export enum StatusEvent {
  ModelChanged = 'model_changed',
}

/** Extra payload on conversation messages (attachments, forms, status events). */
export class ConversationMessageCustomContentDto extends MessageCustomContentDto {
  @ApiPropertyOptional({
    enum: StatusEvent,
    description: 'Status event discriminator when role is status',
  })
  @IsOptional()
  @IsEnum(StatusEvent)
  event_type?: StatusEvent;

  @ApiPropertyOptional({
    description: 'Deployment active before a model_changed event',
    example: 'gpt-4o',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  previous_deployment_id?: string | null;

  @ApiPropertyOptional({
    description: 'Deployment selected after a model_changed event',
    example: 'claude-3',
  })
  @IsOptional()
  @IsString()
  new_deployment_id?: string;
}

export class ConversationMessageDto {
  @ApiPropertyOptional({
    description: 'Unique message identifier',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    enum: ConversationMessageRole,
    example: ConversationMessageRole.User,
  })
  @IsEnum(ConversationMessageRole)
  role!: ConversationMessageRole;

  @ApiProperty({ example: 'Hello!' })
  @IsString()
  content!: string;

  @ApiProperty({ example: '2026-05-19T16:00:00.000Z' })
  @IsString()
  timestamp!: string;

  @ApiPropertyOptional({ type: () => ConversationMessageCustomContentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConversationMessageCustomContentDto)
  custom_content?: ConversationMessageCustomContentDto;

  @ApiPropertyOptional({
    description:
      'Error message when the generation ended in error. Presence signals a terminal error state; absence means the generation succeeded or is still in progress.',
    example: 'You have exceeded your daily token limit.',
  })
  @IsOptional()
  @IsString()
  streamErrorMessage?: string;

  @ApiPropertyOptional({
    description:
      'DIAL Responses API id for this message, set only when the generation was routed through the Responses adapter. Diagnostic only — never used to resume a generation (previous_response_id/conversation are never sent).',
    example: 'dial-gpt-4o-3c1a7e6e-...-uuid',
  })
  @IsOptional()
  @IsString()
  responseId?: string;

  @ApiPropertyOptional({
    description:
      'Deployment that produced this message. Present on assistant and status messages.',
    example: 'gpt-4o',
  })
  @IsOptional()
  @IsString()
  deploymentId?: string;
}
