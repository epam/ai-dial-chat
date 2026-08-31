import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
} from 'class-validator';
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
    description:
      'Access levels granted to holders of the share link. Edit access implies view access, so this is `[View, Edit]` rather than `[Edit]` alone.',
    enum: ShareAccess,
    isArray: true,
    example: [ShareAccess.View],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ShareAccess, { each: true })
  access!: ShareAccess[];
}
