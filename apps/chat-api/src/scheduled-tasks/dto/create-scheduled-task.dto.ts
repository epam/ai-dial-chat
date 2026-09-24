import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { ScheduleTriggerDto } from './schedule-trigger.dto';
import { ScheduledTaskDto } from './scheduled-task.dto';
import { IsValidSkillPathLength } from './skill-path-length.validator';

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

  @ApiProperty({
    example: 'Summarize my inbox',
    description:
      'Instructions; may be empty when the effective task has a skill.',
  })
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'skills/public/daily-summary',
    description:
      'DIAL skill reference with a path of at most 1024 decoded characters. Omission preserves the saved skill on update; null removes it.',
  })
  @IsOptional()
  @IsString()
  @IsValidSkillPathLength()
  @IsValidFilePath()
  @Matches(/^skills\/[\w.-]{1,256}\/(?=.*\S).+$/u, {
    message: 'skillUrl must be a skills/{bucket}/{path} resource reference',
  })
  @Matches(/^[^\p{Cc}]*$/u)
  @Matches(/^(?!.*%(?:0[0-9a-f]|1[0-9a-f]|7f)).*$/i)
  skillUrl?: string | null;

  @ApiPropertyOptional({
    example: 'Summarizes unread inbox items every morning',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreatedScheduledTaskDto extends ScheduledTaskDto {}
