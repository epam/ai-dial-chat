import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/**
 * Request body for `POST /api/v1/catalog/{entityType}/{entityId}/unpublish`.
 * Mirrors {@link PublishCatalogEntityDto} field for field, minus `rules`:
 * a removal request grants nobody anything, so forwarding access rules would
 * imply otherwise.
 *
 * `targetUrl` is deliberately absent. The service derives it from
 * `folderPath` with the same helpers publish uses; accepting a
 * client-supplied path under `public/` would move an authorization-relevant
 * string out of the server's control for no benefit.
 */
export class UnpublishCatalogEntityDto {
  @ApiProperty({
    description:
      'Published folder to submit the removal request for, in the same plain form the publish endpoint accepts. Empty means the public root.',
    example: 'Organization/Data Science/Published models',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      "Optional version label, echoed in the response and in DIAL Core's request name so the admin queue shows which version's publication is being reversed. When omitted, versioned resource ids recover it from their {name}__{version} suffix; unversioned Prompt and Skill resources use an empty version.",
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  version?: string;
}
