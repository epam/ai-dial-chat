import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LocaleTextEntryDto } from '../../common/dto/locale-text-entry.dto';
import { LOCALIZED_TEXT_SCHEMA } from '../../common/types/localized-text';
import type { LocalizedText } from '../../common/types/localized-text';
import {
  LOCALE_CODE_PATTERN,
  LOCALE_CODE_VALIDATION_MESSAGE,
} from '../../common/validators/locale-code.pattern';

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
  @Matches(/^([a-zA-Z0-9!*\-.+]+|\*)\/([a-zA-Z0-9!*\-.+]+|\*)$/, { each: true })
  @IsOptional()
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({ example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxInputAttachments?: number;

  /*
   * Additional (non-primary) locale translations for `name`/`description`.
   * Absent/empty means DIAL Core stores plain strings, unchanged from today.
   */
  @ApiPropertyOptional({ type: () => [LocaleTextEntryDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LocaleTextEntryDto)
  @IsOptional()
  locales?: LocaleTextEntryDto[];

  /*
   * Locale that `name`/`description` are written in. Required when `locales`
   * is non-empty; defaults to `'en'` when `locales` is absent.
   */
  @ApiPropertyOptional({ example: 'en' })
  @ValidateIf(
    (o: UpdateApplicationBodyDto) => o.locales != null && o.locales.length > 0,
  )
  @IsString()
  @Matches(LOCALE_CODE_PATTERN, { message: LOCALE_CODE_VALIDATION_MESSAGE })
  primaryLocale?: string;
}

export class UpdatedApplicationDto {
  @ApiProperty({ example: 'users/my-user/applications/my-app' })
  id!: string;

  @ApiPropertyOptional({ example: 'My App', ...LOCALIZED_TEXT_SCHEMA })
  displayName?: LocalizedText;

  @ApiPropertyOptional({ example: 'application' })
  object?: string;
}
