import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  BUCKET_NAME_PATTERN,
  BUCKET_NAME_VALIDATION_MESSAGE,
} from '../../common/validators/bucket-name.pattern';
import { DialFileNodeType } from './dial-file-node-type';
import { IsValidFilePath } from './file-path.validator';

/*
 * The name becomes a ZIP entry name (and the root of a folder's entries), so it
 * must be one path segment: no separators, no `.`/`..`, no control characters.
 */
export const ARCHIVE_ENTRY_NAME_PATTERN = /^(?!\.{1,2}$)[^/\\\p{Cc}]+$/u;

export const ArchiveItemNodeType = DialFileNodeType;
export type ArchiveItemNodeType = DialFileNodeType;

export class ArchiveItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(BUCKET_NAME_PATTERN, { message: BUCKET_NAME_VALIDATION_MESSAGE })
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @IsValidFilePath()
  @ApiProperty({
    description: 'File or folder path within the bucket',
    example: 'reports/',
  })
  path!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(ARCHIVE_ENTRY_NAME_PATTERN, {
    message:
      'name must be a single path segment without "/", "\\", control characters, "." or ".."',
  })
  @ApiProperty({
    description:
      'Display name for archive entry; a single path segment (no "/", "\\", "." or "..")',
    example: 'reports',
  })
  name!: string;

  @IsEnum(ArchiveItemNodeType)
  @ApiProperty({ enum: ArchiveItemNodeType })
  nodeType!: ArchiveItemNodeType;
}

export class DownloadArchiveDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ArchiveItemDto)
  @ApiProperty({ type: [ArchiveItemDto] })
  items!: ArchiveItemDto[];
}
