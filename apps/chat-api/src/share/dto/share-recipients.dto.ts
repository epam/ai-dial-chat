import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { IsCatalogResourcePath } from './catalog-resource-path.validator';

/** Query parameters for `GET /api/v1/share/recipients`. */
export class GetShareRecipientsDto {
  @ApiProperty({
    description:
      'Identifier of the owned catalog item, skill, conversation, or prompt to count current recipients for — a full DIAL Core resource path.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  @IsCatalogResourcePath()
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
