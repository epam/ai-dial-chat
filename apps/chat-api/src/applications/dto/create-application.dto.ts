import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
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

export class CreateApplicationBodyDto {
  @ApiProperty({ example: 'My App' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9 _.-]+$/, {
    message:
      'name must contain only letters, digits, spaces, underscores, dots, and dashes',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'https://mydial.epam.com/custom_application_schemas/quickapps2',
    description: 'Omit for plain custom applications with no schema type',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ example: 'A custom application.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.svg' })
  @IsString()
  @IsOptional()
  @IsUrl()
  iconUrl?: string;

  @ApiPropertyOptional({ example: '1.0' })
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'version must contain only letters, digits, dots, underscores, and dashes',
  })
  version?: string;

  @ApiPropertyOptional({ example: ['nlp', 'assistant'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  topics?: string[];

  @ApiPropertyOptional({
    example: {
      orchestrator: {
        system_prompt: { type: 'custom', variables: {}, content: '' },
      },
      contexts: [],
      tool_sets: [],
    },
  })
  @IsObject()
  @IsOptional()
  applicationProperties?: Record<string, unknown>;

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
    (o: CreateApplicationBodyDto) => o.locales != null && o.locales.length > 0,
  )
  @IsString()
  @Matches(LOCALE_CODE_PATTERN, { message: LOCALE_CODE_VALIDATION_MESSAGE })
  primaryLocale?: string;
}

export class CreatedApplicationDto {
  @ApiProperty({ example: 'users/my-user/applications/my-app' })
  id!: string;

  @ApiPropertyOptional({ example: 'My App', ...LOCALIZED_TEXT_SCHEMA })
  displayName?: LocalizedText;

  @ApiPropertyOptional({ example: 'application' })
  object?: string;
}
