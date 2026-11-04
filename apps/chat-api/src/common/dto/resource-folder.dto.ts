import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import {
  RESOURCE_FOLDER_PATH_PATTERN,
  RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
} from '../validators/resource-folder-path.pattern';

/** Query for listing one level of a resource type's personal folders. */
export class ListResourceFoldersQueryDto {
  @ApiPropertyOptional({
    description:
      "Plain-text folder path to list, relative to the caller's bucket. Omit or leave empty for the root.",
    example: 'Design',
  })
  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @Matches(RESOURCE_FOLDER_PATH_PATTERN, {
    message: RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
  })
  path?: string;
}

/** One personal folder of a resource type. */
export class ResourceFolderDto {
  @ApiProperty({ description: 'Folder name, decoded', example: 'Audit Agents' })
  name!: string;

  @ApiProperty({
    description: 'Plain-text folder path relative to the bucket',
    example: 'Design/Audit Agents',
  })
  path!: string;
}

/** Response of a personal folder listing. */
export class ResourceFoldersResponseDto {
  @ApiProperty({ type: [ResourceFolderDto] })
  folders!: ResourceFolderDto[];
}

/** Body for moving a resource into one of the caller's folders. */
export class MoveResourceDto {
  @ApiProperty({
    description:
      "Plain-text destination folder relative to the caller's bucket. Empty string moves the resource to the root.",
    example: 'Design',
  })
  @IsString()
  @IsValidFilePath()
  @Matches(RESOURCE_FOLDER_PATH_PATTERN, {
    message: RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
  })
  folderPath!: string;
}

/** Full DIAL Core id of the resource an operation produced. */
export class ResourceIdResponseDto {
  @ApiProperty({
    description: 'Full resource id `{type}/{bucket}/{path}`',
    example: 'applications/6FEup.../Design/agent__1.0.0',
  })
  id!: string;
}
