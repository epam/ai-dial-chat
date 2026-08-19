import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillNodeType } from './skill-node-type';

/**
 * One grouping folder or skill entry, normalized from DIAL Core's
 * `MetadataBase` (`ResourceFolderMetadata | ResourceItemMetadata`) — see
 * design.md's DTO sketches. `etag`/`author`/`createdAt`/`updatedAt` are only
 * ever present on an `item` (a skill), never on a `folder`.
 */
export class SkillMetadataItemDto {
  @ApiProperty({ description: 'Resource name (last path segment)' })
  name!: string;

  @ApiProperty({ description: 'Relative path within the bucket' })
  path!: string;

  @ApiProperty({
    description: 'Full DIAL Core resource URL (skills/{bucket}/{path})',
  })
  url!: string;

  @ApiProperty({ description: 'DIAL Core bucket name' })
  bucket!: string;

  @ApiProperty({ enum: SkillNodeType })
  nodeType!: SkillNodeType;

  @ApiPropertyOptional({ description: 'Parent grouping-folder path' })
  parentPath?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'READ/WRITE/SHARE permissions on this resource',
  })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Resource version ETag (item only)' })
  etag?: string;

  @ApiPropertyOptional({ description: 'Author (item only)' })
  author?: string;

  @ApiPropertyOptional({ description: 'Unix timestamp ms (item only)' })
  createdAt?: number;

  @ApiPropertyOptional({ description: 'Unix timestamp ms (item only)' })
  updatedAt?: number;

  @ApiPropertyOptional({
    description: 'Whether the skill belongs to the requestor',
  })
  isMy?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the requestor may update the skill. Organisation skills are always read-only.',
  })
  canEdit?: boolean;

  @ApiPropertyOptional({
    description: 'Whether another user shared the skill with the requestor',
  })
  sharedWithMe?: boolean;
}

export class SkillListResponseDto {
  @ApiProperty({ description: 'DIAL Core bucket name' })
  bucket!: string;

  @ApiProperty({ description: 'The listed grouping-folder path' })
  path!: string;

  @ApiProperty({ type: [SkillMetadataItemDto] })
  items!: SkillMetadataItemDto[];

  @ApiPropertyOptional({ description: 'Pagination continuation token' })
  nextToken?: string;
}

/** Same shape as `SkillListResponseDto`, scoped to one skill's own files. */
export class SkillFileListResponseDto extends SkillListResponseDto {}

export class SkillCatalogListResponseDto {
  @ApiProperty({ type: [SkillMetadataItemDto] })
  skills!: SkillMetadataItemDto[];

  @ApiProperty({ type: [SkillMetadataItemDto] })
  sharedWithMe!: SkillMetadataItemDto[];

  @ApiProperty({ type: [SkillMetadataItemDto] })
  publicSkills!: SkillMetadataItemDto[];
}
