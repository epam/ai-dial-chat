import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/*
 * General-step update body. `applicationProperties` and `type` are
 * intentionally excluded so this endpoint can never mutate a Quick App's
 * orchestrator/tool-set configuration.  `version` is included here for
 * custom (plain-endpoint) apps where version is a General-step field.
 */
export class UpdateApplicationBodyDto {
  @ApiProperty({ example: 'My App' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9 _.-]+$/, {
    message:
      'name must contain only letters, digits, spaces, underscores, dots, and dashes',
  })
  name!: string;

  @ApiPropertyOptional({ example: 'A custom application.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.svg' })
  @IsString()
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ example: ['nlp', 'assistant'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topics?: string[];

  @ApiPropertyOptional({
    example: 'Summarizes long documents in one line.',
    maxLength: 90,
  })
  @IsString()
  @IsOptional()
  @MaxLength(90)
  intro?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'version must contain only letters, digits, dots, underscores, and dashes',
  })
  version?: string;

  @ApiPropertyOptional({ example: 'https://api.example.com/chat' })
  @IsString()
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  endpoint?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({ example: ['image/png'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxInputAttachments?: number;
}

export class UpdatedApplicationDto {
  @ApiProperty({ example: 'users/my-user/applications/my-app' })
  id!: string;

  @ApiPropertyOptional({ example: 'My App' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'application' })
  object?: string;
}
