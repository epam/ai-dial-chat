import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import {
  CONTROL_CHARACTERS_MESSAGE,
  DISPLAY_AUTHOR_MAX_LENGTH,
  NO_CONTROL_CHARACTERS,
} from './publish-author';
import { PublishRuleDto } from './publish-rule.dto';

/**
 * Request body for `POST /api/v1/catalog/{entityType}/{entityId}/publish`.
 * DIAL Core's Publication API has no version concept. Callers may supply a
 * display version; the service otherwise recovers one from versioned resource
 * ids and leaves unversioned Prompt/Skill publications empty.
 *
 * `author` is likewise optional: it sets the publication's `displayAuthor`,
 * which the catalog shows as "Hosted by". Omitting it keeps the pre-existing
 * behaviour of attributing the publication to whoever submitted it.
 */
export class PublishCatalogEntityDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.',
    example: 'Organization/Data Science/Published models',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      'Optional version label. When omitted, versioned resource ids recover it from their {name}__{version} suffix; unversioned resources use an empty version.',
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description:
      'Display author recorded on the publication as `displayAuthor`, surfaced in the catalog as the published entity\'s "Hosted by" value. Omitted, blank, or whitespace-only falls back to the session\'s own display name, which is what every caller got before this field existed.',
    example: 'DIAL Team',
    maxLength: DISPLAY_AUTHOR_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(DISPLAY_AUTHOR_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: CONTROL_CHARACTERS_MESSAGE })
  author?: string;

  @ApiPropertyOptional({
    description:
      'Access-restriction rules combined with AND; forwarded to DIAL Core unchanged. Omitted or empty means no additional restriction.',
    type: [PublishRuleDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublishRuleDto)
  rules?: PublishRuleDto[];
}
