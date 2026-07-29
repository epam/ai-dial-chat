import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export const SCHEDULE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const SCHEDULE_ID_VALIDATION_MESSAGE =
  'scheduleId must contain only letters, digits, underscores, and dashes (max 128 characters)';

export class GetScheduledTaskDto {
  @ApiProperty({
    description: 'DIAL Scheduler schedule identifier.',
    example: 'sched_123',
    pattern: SCHEDULE_ID_PATTERN.source,
  })
  @IsString()
  @Matches(SCHEDULE_ID_PATTERN, {
    message: SCHEDULE_ID_VALIDATION_MESSAGE,
  })
  scheduleId!: string;
}
