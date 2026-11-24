import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import {
  CONTROL_CHARACTERS_MESSAGE,
  DISPLAY_AUTHOR_MAX_LENGTH,
  NO_CONTROL_CHARACTERS,
} from '../../publish/dto/publish-author';

/**
 * Request body for `POST /api/v1/conversations/publish`. Unlike
 * `PublishCatalogEntityDto`, there is no `version` field — conversations
 * have no version concept.
 *
 * `author` is optional and validated identically to the catalog endpoint's:
 * it sets the publication's `displayAuthor`, and omitting it keeps the
 * pre-existing behaviour of attributing the publication to whoever
 * submitted it.
 */
export class PublishConversationDto {
  @ApiProperty({
    description:
      'Destination folder under the Organization/public bucket, forwarded to DIAL Core as `targetFolder`.',
    example: 'Organization/Data Science/Shared chats',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;

  @ApiPropertyOptional({
    description:
      "Display author recorded on the publication as `displayAuthor`. Omitted, blank, or whitespace-only falls back to the session's own display name, which is what every caller got before this field existed.",
    example: 'DIAL Team',
    maxLength: DISPLAY_AUTHOR_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(DISPLAY_AUTHOR_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS, { message: CONTROL_CHARACTERS_MESSAGE })
  author?: string;
}
