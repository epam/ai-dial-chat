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
}
