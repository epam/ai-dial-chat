import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
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

/**
 * Resource kinds whose `itemId` is not already a full DIAL Core resource path
 * and therefore has to be qualified server-side.
 */
export enum ShareResourceKind {
  Prompt = 'prompt',
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

  @ApiPropertyOptional({
    description:
      "Set to `prompt` when `itemId` is a bucket-relative prompt path (as returned by the prompts endpoints) rather than a full DIAL Core resource path. The caller's own bucket is then used to qualify it.",
    enum: ShareResourceKind,
    example: ShareResourceKind.Prompt,
  })
  @IsOptional()
  @IsEnum(ShareResourceKind)
  resourceKind?: ShareResourceKind;

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
