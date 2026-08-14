import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/*
 * Same allowlist as `RevokeSharedAccessDto`: the count exists only to decide
 * whether revoking is worth offering, so anything revoke cannot act on has no
 * count worth answering either.
 */
const CATALOG_RESOURCE_PATH_PATTERN =
  /^(?:applications|toolsets|conversations)\/[^/\s]+\/[^/\r\n][^\r\n]*(?![\s\S])/;

/** Query parameters for `GET /api/v1/share/recipients`. */
export class GetShareRecipientsDto {
  @ApiProperty({
    description:
      'Identifier (DIAL Core resource path) of the owned catalog item or conversation to count current recipients for.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @Matches(CATALOG_RESOURCE_PATH_PATTERN, {
    message:
      'itemId must identify an application, toolset, or conversation resource with a bucket and item path',
  })
  @MaxLength(2048)
  itemId!: string;
}

/** Response body for `GET /api/v1/share/recipients`. */
export class ShareRecipientsResponseDto {
  @ApiProperty({
    description: 'The resource the count belongs to, echoed from the request.',
    example: 'applications/owner-bucket/my-app',
  })
  itemId!: string;

  @ApiProperty({
    description:
      'How many users currently hold shared access to the resource. Counts accepted invitations only — an issued but unopened share link is not counted, so `0` means "nobody holds access", not "never shared".',
    example: 3,
  })
  recipientsCount!: number;
}
