import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsDialResourceId } from '../../common/validators/dial-resource-id.validator';
import { IsCatalogResourcePath } from './catalog-resource-path.validator';

/** Request body for `POST /api/v1/share/revoke`. */
export class RevokeSharedAccessDto {
  @ApiProperty({
    description:
      'Identifier of the owned catalog item, skill, conversation, or prompt to revoke all shared access to — a full DIAL Core resource path.',
    example: 'applications/owner-bucket/my-app',
  })
  @IsString()
  @IsNotEmpty()
  @IsDialResourceId()
  @IsCatalogResourcePath()
  @MaxLength(2048)
  itemId!: string;
}

/** Response body for `POST /api/v1/share/revoke`. */
export class RevokeSharedAccessResponseDto {
  @ApiProperty({ description: 'true when the revoke call succeeded' })
  success!: boolean;
}
