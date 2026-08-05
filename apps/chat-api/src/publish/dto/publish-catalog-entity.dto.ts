import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { PublishRuleDto } from './publish-rule.dto';

/**
 * Request body for `POST /api/v1/catalog/{entityType}/{entityId}/publish`.
 * `version` is required — DIAL Core's Publication API has no version
 * concept, so the caller (which already knows the entity's current version)
 * supplies it for display in the response and publish-history mapping.
 */
export class PublishCatalogEntityDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.',
    example: 'Organization/Data Science/Published models',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiProperty({
    description: 'Version label for this publish.',
    example: '1.2.0',
  })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiPropertyOptional({
    description:
      'Access-restriction rules combined with AND; forwarded to DIAL Core unchanged. Omitted or empty means no additional restriction.',
    type: [PublishRuleDto],
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PublishRuleDto)
  rules?: PublishRuleDto[];
}
