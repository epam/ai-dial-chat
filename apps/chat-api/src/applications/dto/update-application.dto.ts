import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * General-step-only update body. Deliberately omits `type`, `version`, and
 * `applicationProperties` — those belong to the Settings step and must never
 * be settable through this endpoint, so an update can never touch a Quick
 * App's orchestrator/tool set configuration or its version.
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
}

export class UpdatedApplicationDto {
  @ApiProperty({ example: 'users/my-user/applications/my-app' })
  id!: string;

  @ApiPropertyOptional({ example: 'My App' })
  displayName?: string;

  @ApiPropertyOptional({ example: 'application' })
  object?: string;
}
