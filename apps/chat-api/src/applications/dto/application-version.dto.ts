import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import {
  RESOURCE_FOLDER_PATH_PATTERN,
  RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
} from '../../common/validators/resource-folder-path.pattern';
import { IsSafeResourceId } from '../../common/validators/safe-resource-id.validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Body for forking a stored application into a new version. */
export class ForkApplicationVersionDto {
  @ApiProperty({ example: '1.1.0', description: 'The new version' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'version must contain only letters, digits, dots, underscores, and dashes',
  })
  version!: string;

  @ApiProperty({
    example: 'Design',
    description:
      "Plain-text personal folder for the new version, relative to the caller's bucket. Empty string is the root.",
  })
  @IsString()
  @IsValidFilePath()
  @Matches(RESOURCE_FOLDER_PATH_PATTERN, {
    message: RESOURCE_FOLDER_PATH_VALIDATION_MESSAGE,
  })
  folderPath!: string;
}

/** Body for committing a forked version after the source was saved. */
export class CommitApplicationVersionDto {
  @ApiProperty({
    example: 'applications/6FEup.../agent__1.1.0',
    description:
      "Full id of the snapshot `forkApplicationVersion` returned. Must be in the caller's own bucket.",
  })
  @IsString()
  @IsNotEmpty()
  @IsSafeResourceId()
  @Matches(/^applications\//, {
    message: 'snapshotId must be a full applications/{bucket}/{path} id',
  })
  snapshotId!: string;
}
