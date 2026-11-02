import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdatePinsDto {
  @ApiProperty({
    description:
      'Full DIAL Core resource URL of the conversation or project to pin or unpin (matches `id` in `ConversationListItemDto` or `ProjectDto`). A `projects/` id is stored under `projects.pinnedIds`.',
    example:
      'conversations/default-bucket/gpt-4__My chat__cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8',
  })
  @IsString()
  @IsNotEmpty()
  path!: string;

  @ApiProperty({
    description:
      'Pass `true` to pin the conversation or project, `false` to unpin.',
    example: true,
  })
  @IsBoolean()
  isPinned!: boolean;
}
