import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ScheduledTaskRunStatus {
  Success = 'Success',
  Error = 'Error',
  InProgress = 'InProgress',
  Missed = 'Missed',
}

export class ScheduledTaskRunDto {
  @ApiProperty({ example: 'run_9f2a' })
  id!: string;

  @ApiProperty({ enum: ScheduledTaskRunStatus, example: 'Success' })
  @IsEnum(ScheduledTaskRunStatus)
  status!: ScheduledTaskRunStatus;

  @ApiProperty({ example: '2026-07-24T09:00:00.000Z' })
  @IsISO8601()
  startTime!: string;

  @ApiPropertyOptional({
    type: String,
    example: '2026-07-24T09:01:39.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  endTime?: string | null;

  @ApiPropertyOptional({ example: 99 })
  @IsOptional()
  @IsInt()
  durationSeconds?: number;

  @ApiPropertyOptional({
    example:
      'conversations/bucket/.scheduler/sched_123/dial-chathub-v2-gemini-3.5-flash__123123123123123__run_9f2a',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
