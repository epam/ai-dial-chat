import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** One conversation stored inside a project. */
export class ProjectConversationItemDto {
  @ApiProperty({
    description:
      'Locator of the conversation, `projects/{bucket}/{projectPath}/conversations/{name}`; it is the conversation id.',
    example:
      'projects/a1b2c3/support-quality/conversations/gpt-4o__Weekly support health summary__7c1d',
  })
  @IsString()
  id!: string;

  @ApiProperty({
    description: 'File name under the project `conversations/` folder.',
    example: 'gpt-4o__Weekly support health summary__7c1d',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    description:
      "Display title: the stored body's `name`, or the title derived from the file name when the body cannot be read.",
    example:
      'Write a weekly support health summary for the VP of Customer Success.',
  })
  @IsString()
  title!: string;

  @ApiPropertyOptional({
    description:
      "Display name of the conversation's last writer, from DIAL Core.",
    example: 'Valery Tester',
  })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: 'Last update time, in epoch milliseconds.',
    example: 1793000000000,
  })
  @IsOptional()
  @IsInt()
  updatedAt?: number;
}

/** Response of `GET /api/v1/projects/:id/conversations`. */
export class ProjectConversationListResponseDto {
  @ApiProperty({
    type: [ProjectConversationItemDto],
    description: 'Conversations, newest first.',
  })
  @ValidateNested({ each: true })
  items!: ProjectConversationItemDto[];

  @ApiProperty({
    description: 'Whether the project holds more conversations than `items`.',
    example: false,
  })
  @IsBoolean()
  hasMore!: boolean;
}
