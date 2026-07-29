import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ScheduleTriggerDto } from './schedule-trigger.dto';
import { ScheduledTaskDto } from './scheduled-task.dto';

export class CreateScheduledTaskBodyDto {
  @ApiProperty({ example: 'Daily summary' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  displayName!: string;

  @ApiProperty({ type: ScheduleTriggerDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ScheduleTriggerDto)
  trigger!: ScheduleTriggerDto;

  @ApiProperty({ example: 'gpt-4.1-mini-2025-04-14' })
  @IsString()
  @IsNotEmpty()
  model!: string;

  @ApiProperty({ example: 'Summarize my inbox' })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({
    example: 'Summarizes unread inbox items every morning',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;
}

export class CreatedScheduledTaskDto extends ScheduledTaskDto {}
