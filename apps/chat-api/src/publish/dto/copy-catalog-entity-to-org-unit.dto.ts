import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  RESOURCE_FOLDER_PATH_PATTERN,
  RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
} from '../../common/validators/resource-folder-path.pattern';
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
    default: false,
    description:
      'Replace the entity already stored under the same name in the folder. Without it an existing target answers 409.',
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
