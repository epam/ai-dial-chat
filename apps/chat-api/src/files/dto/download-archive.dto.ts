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
import { IsValidFilePath } from './file-path.validator';

export enum ArchiveItemNodeType {
  Item = 'item',
  Folder = 'folder',
}

export class ArchiveItemDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
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
  @ApiProperty({
    description: 'Display name for archive entry',
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
