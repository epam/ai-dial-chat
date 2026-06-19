import { ApiPropertyOptional } from '@nestjs/swagger';

export class FileMetadataResponseDto {
  @ApiPropertyOptional({ description: 'File name without path' })
  name?: string;

  @ApiPropertyOptional({ description: 'Node type, expected "item" for files' })
  nodeType?: string;

  @ApiPropertyOptional()
  bucket?: string;

  @ApiPropertyOptional()
  parentPath?: string;

  @ApiPropertyOptional({ description: 'DIAL Core resource URL' })
  url?: string;

  @ApiPropertyOptional()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'ETag; not available for folders' })
  etag?: string;

  @ApiPropertyOptional()
  contentLength?: number;

  @ApiPropertyOptional()
  contentType?: string;

  @ApiPropertyOptional({
    description:
      'Creation time in Unix milliseconds; not supported by all storage providers',
  })
  createdAt?: number;

  @ApiPropertyOptional({
    description: 'Last-modified time in Unix milliseconds',
  })
  updatedAt?: number;

  @ApiPropertyOptional({ type: [String], description: 'READ | WRITE | SHARE' })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Author; not available for folders' })
  author?: string;
}
