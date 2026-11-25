import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ContentSourceKind } from '../content-sources-registry.service';

export const CONTENT_SOURCE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const CONTENT_SOURCE_PATH_MAX_LENGTH = 1024;

/*
 * Deliberately not pattern-validated: any id that is not configured answers
 * 404, including a malformed one, so a client cannot tell "unconfigured" from
 * "never valid".
 */
export class ContentSourceParamsDto {
  @ApiProperty({
    description:
      'Source id from the deployment-configured CONTENT_SOURCES_CONFIG registry.',
    example: 'release-notes',
    pattern: CONTENT_SOURCE_ID_PATTERN.source,
  })
  @IsString()
  @MaxLength(64)
  sourceId!: string;
}

/*
 * `path` is not allowlist-matched, unlike GetThemeIconDto.iconName: repository
 * file names legitimately contain spaces and non-ASCII letters, which an
 * allowlist would turn into 400s for documents the listing itself returns.
 * The safety boundary is normalizeContentPath (rejects absolute, backslash,
 * control characters and root escapes) plus the source-root and include checks
 * in ContentSourcesService, all before any upstream call. See design.md,
 * decision 12.
 */
export class ContentSourcePathQueryDto {
  @ApiProperty({
    description:
      'Repository-relative path, normalized by the server. Absolute paths, backslashes, NUL and ".." segments that escape the root are rejected.',
    example: 'docs/releases/1.0.0.md',
    maxLength: CONTENT_SOURCE_PATH_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CONTENT_SOURCE_PATH_MAX_LENGTH)
  path!: string;
}

export class ContentSourceFeedDto {
  @ApiPropertyOptional({
    description:
      'Heading text whose section a feed client uses as the document summary.',
    example: 'Summary',
  })
  summaryHeading?: string;
}

export class ContentDocumentSummaryDto {
  @ApiProperty({ example: 'docs/releases/1.0.0.md' })
  path!: string;

  @ApiProperty({
    description:
      'First H1 of the document, or its file name without extension.',
    example: 'Release 1.0.0',
  })
  title!: string;

  @ApiProperty({
    description:
      'Created or updated commit date; null when the source has no dates or the date is unknown.',
    type: String,
    format: 'date-time',
    nullable: true,
  })
  date!: string | null;
}

export class ContentSourceResponseDto {
  @ApiProperty({ example: 'release-notes' })
  id!: string;

  @ApiProperty({ example: 'Release notes' })
  title!: string;

  @ApiProperty({ enum: ContentSourceKind, enumName: 'ContentSourceKind' })
  kind!: ContentSourceKind;

  @ApiProperty({ type: ContentSourceFeedDto })
  feed!: ContentSourceFeedDto;

  @ApiProperty({
    description: 'Repository page of the source on the hosting provider.',
    example:
      'https://github.com/epam/ai-dial-chat/tree/development/docs/releases',
  })
  webUrl!: string;

  @ApiProperty({ type: [ContentDocumentSummaryDto] })
  documents!: ContentDocumentSummaryDto[];
}

export class ContentDocumentResponseDto {
  @ApiProperty({ example: 'docs/releases/1.0.0.md' })
  path!: string;

  @ApiProperty({ example: 'Release 1.0.0' })
  title!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
  })
  date!: string | null;

  @ApiProperty({
    description:
      'Document Markdown exactly as stored in the repository. Untrusted: clients must sanitize their rendering and rewrite relative links themselves.',
  })
  markdown!: string;

  @ApiProperty({
    description: 'Page of the document on the hosting provider.',
  })
  webUrl!: string;
}
