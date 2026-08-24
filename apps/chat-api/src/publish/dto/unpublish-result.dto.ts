import { ApiProperty } from '@nestjs/swagger';
import { CatalogEntityType } from './catalog-entity-params.dto';

/**
 * Response body for `POST /api/v1/catalog/{entityType}/{entityId}/unpublish`.
 *
 * The field names deliberately differ from {@link PublishResultDto}'s
 * `publishedAt`/`publishedBy`: DIAL Core returns a `PENDING` publication, so
 * this describes a submitted request, not a completed removal. No field here
 * may assert that the entity is no longer published.
 */
export class UnpublishResultDto {
  @ApiProperty({ example: 'toolsets/bucket-123/tool-abc123__1.2.0' })
  entityId!: string;

  @ApiProperty({ enum: CatalogEntityType, example: CatalogEntityType.Toolset })
  entityType!: CatalogEntityType;

  @ApiProperty({ example: 'Organization/Data Science/Published models' })
  folderPath!: string;

  @ApiProperty({
    description: 'Empty for unversioned Prompt and Skill resources.',
    example: '1.2.0',
  })
  version!: string;

  @ApiProperty({ example: '2026-08-13T10:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ example: 'user@example.com' })
  requestedBy!: string;
}
