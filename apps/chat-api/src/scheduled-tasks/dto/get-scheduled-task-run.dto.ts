import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  SCHEDULE_ID_PATTERN,
  SCHEDULE_ID_VALIDATION_MESSAGE,
} from './get-scheduled-task.dto';

export const RUN_ID_VALIDATION_MESSAGE =
  'runId must contain only letters, digits, underscores, and dashes (max 128 characters)';

/** Validated identifiers required to read one scheduled-task run. */
export class GetScheduledTaskRunDto {
  @ApiProperty({
    description: 'DIAL Scheduler schedule identifier.',
    example: 'sched_123',
    pattern: SCHEDULE_ID_PATTERN.source,
  })
  @IsString()
  @Matches(SCHEDULE_ID_PATTERN, { message: SCHEDULE_ID_VALIDATION_MESSAGE })
  scheduleId!: string;

  @ApiProperty({
    description: 'DIAL Scheduler run identifier.',
    example: 'run_9f2a',
    pattern: SCHEDULE_ID_PATTERN.source,
  })
  @IsString()
  @Matches(SCHEDULE_ID_PATTERN, { message: RUN_ID_VALIDATION_MESSAGE })
  runId!: string;
}
