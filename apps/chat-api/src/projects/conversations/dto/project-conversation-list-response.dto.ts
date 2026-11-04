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
      "Display title: the stored body's `name`, or the title derived from the file name when the body cannot be read or is not read yet (`isTitlePending`).",
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

  @ApiProperty({
    description:
      "Whether the conversation changed after the caller's read baseline and since the caller last viewed it; `false` when the caller's read state cannot be read or the title is pending.",
    example: false,
  })
  @IsBoolean()
  isUnread!: boolean;

  @ApiPropertyOptional({
    description:
      'Present and `true` when the body was not read for this listing: `title` is the file-name title and `isUnread` is `false`. `POST /api/v1/projects/:id/conversations/titles` resolves both.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isTitlePending?: boolean;
}

/** Response of `GET /api/v1/projects/:id/conversations`. */
export class ProjectConversationListResponseDto {
  @ApiProperty({
    type: [ProjectConversationItemDto],
    description:
      'Every conversation of the project, newest first. Titles of the first 20 and of cached ones are resolved; the rest carry `isTitlePending`.',
  })
  @ValidateNested({ each: true })
  items!: ProjectConversationItemDto[];
}
