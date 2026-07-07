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
}
