import { ApiProperty } from '@nestjs/swagger';
import { CatalogEntityType } from './catalog-entity-params.dto';

/** One entry in the `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` response, mapped from a DIAL Core `Publication`. */
export class PublishHistoryEntryDto {
  @ApiProperty({ example: 'tool-abc123' })
  entityId!: string;

  @ApiProperty({ enum: CatalogEntityType, example: CatalogEntityType.Toolset })
  entityType!: CatalogEntityType;

  @ApiProperty({ example: 'Organization/Data Science/Published models' })
  folderPath!: string;

  @ApiProperty({ example: '1.2.0' })
  version!: string;

  @ApiProperty({ example: '2026-07-13T10:00:00.000Z' })
  publishedAt!: string;

  @ApiProperty({ example: 'user@example.com' })
  publishedBy!: string;

  @ApiProperty({
    description:
      "Whether this publication requested that the publisher's own credential for the entity be published alongside it. Reports what was requested, not what DIAL Core ultimately applied — Core is the authority on that. A publication that predates the field reports `false`.",
    example: true,
  })
  publishCredentials!: boolean;
}
