import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { IsCatalogResourcePath } from './catalog-resource-path.validator';

/*
 * The catalog resource pattern's trailing segment is unrestricted, so it also
 * matches a deeper nested path like `skills/{bucket}/{skillPath}/files/{filePath}`.
 * This negative-lookahead rejects any `skills/`-prefixed itemId containing a
 * `/files/` segment, so only whole-skill URLs are accepted — skills remain
 * whole-resource units for sharing (catalog-unshare spec). Harmless no-op for
 * every other prefix, including `prompts/`.
 */
const NOT_A_SKILL_FILE_PATTERN = /^(?!skills\/.*\/files\/).*$/;

/** Request body for `POST /api/v1/share/discard`. */
export class DiscardSharedCatalogItemDto {
  @ApiProperty({
    description:
      'Identifier of the catalog item, skill, conversation, or prompt to discard access to — a full DIAL Core resource path.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @IsCatalogResourcePath()
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
