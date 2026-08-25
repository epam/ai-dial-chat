import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';

/**
 * Request body for `POST /api/v1/conversations/unpublish`. Mirrors
 * {@link PublishConversationDto} minus `rules`: access rules govern who may
 * see a published resource, and a removal request grants nobody anything.
 *
 * Like publish, there is no `version` field — conversations have no version
 * concept — and no `targetUrl`: the service derives it from `folderPath` with
 * the same helpers publish uses, so a caller cannot name an arbitrary path
 * under `public/`.
 */
export class UnpublishConversationDto {
  @ApiProperty({
    description:
      'Published folder to submit the removal request for, in the same plain form the publish endpoint accepts. Empty means the public root.',
    example: 'Organization/Data Science/Shared chats',
  })
  @IsString()
  @IsValidFilePath()
  folderPath!: string;
}
