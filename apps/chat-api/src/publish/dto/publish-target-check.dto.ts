import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import {
  STORED_RESOURCE_VERSION_PATTERN,
  STORED_RESOURCE_VERSION_VALIDATION_MESSAGE,
} from '../../common/validators/resource-version.pattern';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/** Query of `GET /api/v1/catalog/{entityType}/{entityId}/publish-target`. */
export class PublishTargetCheckQueryDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket, as the publish request sends it.',
    example: 'Organization/Data Science',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      'Optional version label, as the publish request sends it; it names the published copy of an application or toolset.',
    example: '1.2.0',
  })
  @IsOptional()
  @IsString()
  @Matches(STORED_RESOURCE_VERSION_PATTERN, {
    message: STORED_RESOURCE_VERSION_VALIDATION_MESSAGE,
  })
  version?: string;
}

/** Whether the published copy's path is taken. */
export class PublishTargetCheckDto {
  @ApiProperty({
    description:
      'True when the caller can read a resource at the target. False means none was found, not that none is there: a copy hidden from the caller by access rules, or one still pending approval, is not detected. The publish endpoint answers `409` for those.',
    example: false,
  })
  taken!: boolean;
}
