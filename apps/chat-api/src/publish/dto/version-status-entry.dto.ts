import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Publication state of one saved version of an application or toolset. */
export enum VersionPublicationStatus {
  /** No live or pending publication of the version. */
  NotPublished = 'not-published',
  /** A publication request of the version is waiting for an administrator. */
  InReview = 'in-review',
  /** An approved publication of the version is live. */
  Published = 'published',
  /** The version belongs to another user, whose publications the caller cannot read. */
  Unknown = 'unknown',
}

/** One entry of the `GET /api/v1/catalog/{entityType}/{entityId}/version-statuses` response. */
export class VersionStatusEntryDto {
  @ApiProperty({
    description:
      'DIAL Core resource id of the version, as the listings return it.',
    example: 'applications/abc/Design/Review__1.0.0',
  })
  id!: string;

  @ApiProperty({
    description:
      'Display version of the version; empty when the resource has none.',
    example: '1.0.0',
  })
  version!: string;

  @ApiProperty({
    enum: VersionPublicationStatus,
    enumName: 'VersionPublicationStatus',
    example: VersionPublicationStatus.Published,
  })
  status!: VersionPublicationStatus;

  @ApiProperty({
    description:
      'Folders a published version is published to, without the `public/` prefix; empty otherwise.',
    type: [String],
    example: ['Organization/Design'],
  })
  publishedFolders!: string[];

  @ApiPropertyOptional({
    description: 'Display name of the publisher of a published version.',
    example: 'Jane Doe',
  })
  publishedBy?: string;
}
