import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import {
  DISPLAY_NAME_PATTERN,
  DISPLAY_NAME_VALIDATION_MESSAGE,
} from '../validators/display-name.pattern';
import {
  LOCALE_CODE_PATTERN,
  LOCALE_CODE_VALIDATION_MESSAGE,
} from '../validators/locale-code.pattern';

/**
 * One additional (non-primary) locale's translated name/description,
 * submitted alongside a toolset/application's primary `name`/`description`.
 */
export class LocaleTextEntryDto {
  @ApiProperty({ example: 'de' })
  @IsString()
  @Matches(LOCALE_CODE_PATTERN, { message: LOCALE_CODE_VALIDATION_MESSAGE })
  language!: string;

  @ApiPropertyOptional({ example: 'Mein Toolset' })
  @IsString()
  @IsOptional()
  @Matches(DISPLAY_NAME_PATTERN, { message: DISPLAY_NAME_VALIDATION_MESSAGE })
  name?: string;

  @ApiPropertyOptional({ example: 'Meine Toolset-Beschreibung' })
  @IsString()
  @IsOptional()
  description?: string;
}
