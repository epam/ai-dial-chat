import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

const CATALOG_RESOURCE_PATH_PATTERN =
  /^(?:applications|toolsets|conversations|skills)\/[^/\s]+\/[^/\r\n][^\r\n]*(?![\s\S])/;

/** Request body for `POST /api/v1/share/revoke`. */
export class RevokeSharedAccessDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the owned catalog item, skill, or conversation to revoke all shared access to.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(CATALOG_RESOURCE_PATH_PATTERN, {
    message:
      'itemId must identify an application, toolset, skill, or conversation resource with a bucket and item path',
  })
  @MaxLength(2048)
  itemId!: string;
}

/** Response body for `POST /api/v1/share/revoke`. */
export class RevokeSharedAccessResponseDto {
  @ApiProperty({ description: 'true when the revoke call succeeded' })
  success!: boolean;
}
