import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { FOLDER_NODE_TYPE } from '../files.constants';
import { IsValidFilePath } from './file-path.validator';
import { IsNotReservedMarkerName } from './marker-name.validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Parent folder path within bucket (no leading slash, no ..)',
    example: 'reports/',
  })
  parentPath?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[^/\\\0.][^/\\\0]{0,253}$/, {
    message:
      'name must not start with / \\ . or null; must not contain / \\ or null; max 254 characters',
  })
  @IsNotReservedMarkerName()
  @MaxLength(254)
  @ApiProperty({ description: 'Folder name', example: 'reports' })
  name!: string;
}

export class CreateFolderResponseDto {
  @ApiProperty({ example: 'reports' })
  name!: string;

  @ApiProperty({ example: 'reports/' })
  path!: string;

  @ApiProperty({ example: '' })
  parentPath!: string;

  @ApiProperty({ example: 'my-bucket' })
  bucket!: string;

  @ApiProperty({ example: FOLDER_NODE_TYPE })
  nodeType!: string;

  @ApiProperty({ example: 'my-bucket:reports/' })
  folderId!: string;
}
