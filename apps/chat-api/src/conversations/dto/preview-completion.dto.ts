import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const MAX_PREVIEW_MESSAGES = 100;

export enum PreviewMessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
}

export class PreviewMessageDto {
  @ApiProperty({
    enum: PreviewMessageRole,
    example: PreviewMessageRole.User,
  })
  @IsEnum(PreviewMessageRole)
  role!: PreviewMessageRole;

  @ApiProperty({ example: 'Hello!', maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content!: string;
}

export class PreviewCompletionDto {
  @ApiProperty({
    description: 'DIAL Core deployment name (the application under preview)',
    example: 'applications/my-custom-app',
    maxLength: 256,
  })
  @IsString()
  @MaxLength(256)
  model!: string;

  @ApiProperty({
    description:
      'Full client-held message transcript. The client is the source of truth — no server-side conversation is read or written.',
    type: () => [PreviewMessageDto],
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PREVIEW_MESSAGES)
  @ValidateNested({ each: true })
  @Type(() => PreviewMessageDto)
  messages!: PreviewMessageDto[];

  @ApiPropertyOptional({
    description: 'Client-generated id used only for log correlation.',
    example: 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  generationId?: string;
}
