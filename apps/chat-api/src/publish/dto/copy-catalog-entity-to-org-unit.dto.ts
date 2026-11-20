import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import {
  RESOURCE_FOLDER_PATH_PATTERN,
  RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
} from '../../common/validators/resource-folder-path.pattern';
import {
  STORED_RESOURCE_VERSION_PATTERN,
  STORED_RESOURCE_VERSION_VALIDATION_MESSAGE,
} from '../../common/validators/resource-version.pattern';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Request body for `POST /api/v1/catalog/{entityType}/{entityId}/copy-to-org-unit`. */
export class CopyCatalogEntityToOrgUnitDto {
  @ApiProperty({
    example: 'Acme/US Risk/Teams',
    description:
      'Plain-text destination folder relative to the public bucket, never empty: the public root is not an org unit. DIAL Core decides whether the caller may write there.',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(RESOURCE_FOLDER_PATH_PATTERN, {
    message: RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
  })
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      'Optional version label. For an application or a toolset whose stored name ends in `__{version}` the copy is named with this version, as a publication of it would be; otherwise the stored name is kept.',
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  @Matches(STORED_RESOURCE_VERSION_PATTERN, {
    message: STORED_RESOURCE_VERSION_VALIDATION_MESSAGE,
  })
  version?: string;
}
