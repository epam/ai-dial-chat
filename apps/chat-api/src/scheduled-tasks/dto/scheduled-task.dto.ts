import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ScheduleTriggerDto } from './schedule-trigger.dto';

export enum ScheduleTriggerType {
  Cron = 'cron',
  Date = 'date',
}

export class ScheduledTaskDto {
  @ApiProperty({ example: 'sched_123' })
  id!: string;

  @ApiProperty({ example: 'Daily summary' })
  displayName!: string;

  @ApiProperty({ type: ScheduleTriggerDto })
  @ValidateNested()
  @Type(() => ScheduleTriggerDto)
  trigger!: ScheduleTriggerDto;

  @ApiPropertyOptional({ example: '2026-07-28T12:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  nextRunTime?: string;

  @ApiPropertyOptional({ example: '2026-07-23T21:27:07.000Z' })
  @IsOptional()
  @IsISO8601()
  createdAt?: string;

  @ApiPropertyOptional({ example: '2026-07-23T21:27:07.000Z' })
  @IsOptional()
  @IsISO8601()
  updatedAt?: string;

  @ApiPropertyOptional({ enum: ScheduleTriggerType, example: 'cron' })
  @IsOptional()
  @IsEnum(ScheduleTriggerType)
  triggerType?: ScheduleTriggerType;

  @ApiPropertyOptional({ example: 'dial-oauth' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ example: '70e570e9-cc23-4ffd-9182-078d09f116ac' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
