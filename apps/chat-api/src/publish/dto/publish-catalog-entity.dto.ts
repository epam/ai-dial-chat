import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { PublishRuleDto } from './publish-rule.dto';

/**
 * Request body for `POST /api/v1/catalog/{entityType}/{entityId}/publish`.
 * DIAL Core's Publication API has no version concept. Callers may supply a
 * display version; the service otherwise recovers one from versioned resource
 * ids and leaves unversioned Prompt/Skill publications empty.
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

  @ApiPropertyOptional({
    description:
      'Optional version label. When omitted, versioned resource ids recover it from their {name}__{version} suffix; unversioned resources use an empty version.',
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  version?: string;

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
