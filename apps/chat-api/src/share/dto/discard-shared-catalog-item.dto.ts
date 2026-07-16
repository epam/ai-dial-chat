import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

const CATALOG_RESOURCE_PATH_PATTERN =
  /^(?:applications|toolsets|conversations)\/[^/\s]+\/[^/\r\n][^\r\n]*(?![\s\S])/;

/** Request body for `POST /api/v1/share/discard`. */
export class DiscardSharedCatalogItemDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the catalog item or conversation to discard access to.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(CATALOG_RESOURCE_PATH_PATTERN, {
    message:
      'itemId must identify an application, toolset, or conversation resource with a bucket and item path',
  })
  @MaxLength(2048)
  itemId!: string;
}

export class DiscardSharedCatalogItemResponseDto {
  @ApiProperty({ description: 'true when the discard call succeeded' })
  success!: boolean;
}
