import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { IsValidFilePath } from './file-path.validator';

export class ListFilesQueryDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\w.-]+$/)
  @MaxLength(256)
  @ApiProperty({ description: 'DIAL Core bucket name', example: 'my-bucket' })
  bucket!: string;

  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Folder path within bucket (no leading slash, no ..)',
    example: 'reports/',
  })
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Pagination token from previous response',
  })
  token?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ description: 'Max items to return', example: 100 })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Return items recursively',
    default: false,
  })
  recursive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Include item permissions',
    default: true,
  })
  permissions?: boolean;
}

export enum FileNodeType {
  Item = 'item',
  Folder = 'folder',
}

export class ListFilesItemDto {
  @ApiProperty()
  name!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty()
  folderId!: string;

  @ApiProperty({ enum: FileNodeType })
  nodeType!: string;

  @ApiProperty()
  bucket!: string;

  @ApiPropertyOptional()
  parentPath?: string;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional()
  contentLength?: number;

  @ApiPropertyOptional()
  contentType?: string;

  @ApiPropertyOptional({ description: 'Unix timestamp ms' })
  updatedAt?: number;

  @ApiPropertyOptional({ type: [String] })
  permissions?: string[];

  @ApiPropertyOptional()
  resourceType?: string;

  @ApiPropertyOptional()
  author?: string;
}

export class ListPublicFilesQueryDto {
  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Folder path within public bucket (no leading slash, no ..)',
    example: 'reports/',
  })
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Pagination token from previous response',
  })
  token?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ description: 'Max items to return', example: 100 })
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Return items recursively',
    default: false,
  })
  recursive?: boolean;
}

export class ListSharedFilesQueryDto {
  @IsOptional()
  @IsString()
  @IsValidFilePath()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Folder path filter (no leading slash, no ..)',
    example: 'reports/',
  })
  path?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  @ApiPropertyOptional({
    description: 'Pagination token from previous response',
  })
  token?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(1000)
  @ApiPropertyOptional({ description: 'Max items to return', example: 100 })
  limit?: number;
}

export class ListFilesResponseDto {
  @ApiProperty()
  bucket!: string;

  @ApiProperty()
  path!: string;

  @ApiProperty({ type: [ListFilesItemDto] })
  items!: ListFilesItemDto[];

  @ApiPropertyOptional()
  nextToken?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'READ/WRITE/SHARE permissions on the listed folder',
  })
  permissions?: string[];
}
