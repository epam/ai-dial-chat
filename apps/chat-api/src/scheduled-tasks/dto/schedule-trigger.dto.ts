import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsOptional,
  IsISO8601,
  ValidateNested,
} from 'class-validator';
import { IsCronFields } from './cron-fields.validator';

export class ScheduleCronDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { minute: '0', hour: '9' },
    description:
      'Cron field map using supported Scheduler keys (year, month, day, week, day_of_week, hour, minute, second).',
  })
  @IsDefined()
  @IsObject()
  @IsCronFields()
  fields!: Record<string, string>;
}

export class ScheduleTriggerDto {
  @ApiPropertyOptional({ example: '2026-07-24T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional({ type: ScheduleCronDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScheduleCronDto)
  cron?: ScheduleCronDto;
}
