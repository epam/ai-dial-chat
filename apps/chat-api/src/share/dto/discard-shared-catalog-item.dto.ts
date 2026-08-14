import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

const CATALOG_RESOURCE_PATH_PATTERN =
  /^(?:applications|toolsets|conversations|skills)\/[^/\s]+\/[^/\r\n][^\r\n]*(?![\s\S])/;

/*
 * The main pattern's trailing segment is unrestricted, so it also matches a
 * deeper nested path like `skills/{bucket}/{skillPath}/files/{filePath}`.
 * This negative-lookahead rejects any `skills/`-prefixed itemId containing a
 * `/files/` segment, so only whole-skill URLs are accepted — skills remain
 * whole-resource units for sharing (catalog-unshare spec). Harmless no-op
 * for every non-`skills/` prefix, which can never match this shape.
 */
const NOT_A_SKILL_FILE_PATTERN = /^(?!skills\/.*\/files\/).*$/;

/** Request body for `POST /api/v1/share/discard`. */
export class DiscardSharedCatalogItemDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the catalog item, skill, or conversation to discard access to.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(CATALOG_RESOURCE_PATH_PATTERN, {
    message:
      'itemId must identify an application, toolset, skill, or conversation resource with a bucket and item path',
  })
  @Matches(NOT_A_SKILL_FILE_PATTERN, {
    message: 'itemId must identify a whole skill, not an individual skill file',
  })
  @MaxLength(2048)
  itemId!: string;
}

export class DiscardSharedCatalogItemResponseDto {
  @ApiProperty({ description: 'true when the discard call succeeded' })
  success!: boolean;
}
