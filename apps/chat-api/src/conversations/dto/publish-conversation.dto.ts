import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/**
 * Request body for `POST /api/v1/conversations/publish`. Unlike
 * `PublishCatalogEntityDto`, there is no `version` field — conversations
 * have no version concept.
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
}
