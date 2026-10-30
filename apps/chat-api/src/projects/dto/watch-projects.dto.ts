import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
} from 'class-validator';
import { PROJECTS_WATCH_MAX_IDS } from '../constants/projects-watch.constants';
import { IsProjectId } from './project-id-param.dto';

/** Body of `POST /api/v1/projects/watch`: the projects to follow. */
export class WatchProjectsBodyDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: PROJECTS_WATCH_MAX_IDS,
    example: [
      'projects/a1b2c3/marketing/q4-launch',
      'projects/public/handbook',
    ],
    description:
      'Unique ids of the listed projects, `projects/{bucket}/{path}` each.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PROJECTS_WATCH_MAX_IDS)
  @ArrayUnique()
  @IsString({ each: true })
  @IsProjectId({ each: true })
  ids!: string[];
}
