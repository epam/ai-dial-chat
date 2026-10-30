import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectWatchAction } from './project-watch-action.enum';

/** One project-level change, written as a `data:` line of the watch stream. */
export class ProjectWatchEventDto {
  @ApiProperty({
    example: 'projects/a1b2c3/marketing/q4-launch',
    description: 'Id of the watched project the event is about.',
  })
  id!: string;

  @ApiProperty({
    enum: ProjectWatchAction,
    enumName: 'ProjectWatchAction',
    example: ProjectWatchAction.Update,
  })
  action!: ProjectWatchAction;

  @ApiProperty({
    example: 1761560100000,
    description:
      'Epoch ms at which DIAL Core published the event; within milliseconds of the stored `updatedAt`, but not equal to it.',
  })
  timestamp!: number;

  @ApiPropertyOptional({
    example: '"c3d4"',
    description: "The project's new aggregate ETag; absent on `DELETE`.",
  })
  etag?: string;
}
