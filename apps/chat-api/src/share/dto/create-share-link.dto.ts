import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/**
 * Access level requested for a share link. Defined locally rather than
 * imported from `@epam/ai-dial-share` to keep the backend DTO independent of
 * the frontend lib's contract (see design decision on access representation).
 */
export enum ShareAccess {
  View = 'view',
  Edit = 'edit',
}

/** Request body for `POST /api/v1/share`. */
export class CreateShareLinkDto {
  @ApiProperty({
    description: 'Identifier (DIAL Core resource path) of the entity to share.',
    example: 'gpt-4o',
  })
  @IsString()
  @IsNotEmpty()
  @IsValidFilePath()
  itemId!: string;

  @ApiProperty({
    description: 'Access level granted to holders of the share link.',
    enum: ShareAccess,
    example: ShareAccess.View,
  })
  @IsEnum(ShareAccess)
  access!: ShareAccess;
}
