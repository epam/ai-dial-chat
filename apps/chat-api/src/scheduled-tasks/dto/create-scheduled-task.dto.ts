import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsArray,
  ValidateIf,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ENTITY_INSTRUCTIONS_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
} from '../../common/validators/entity-field-limits';
import { IsValidFilePath } from '../../files/dto/file-path.validator';
import { ScheduleTriggerDto } from './schedule-trigger.dto';
import { ScheduledTaskDto } from './scheduled-task.dto';
import { IsValidSkillPathLength } from './skill-path-length.validator';

export class CreateScheduledTaskBodyDto {
  @ApiProperty({ example: 'Daily summary', maxLength: ENTITY_NAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ENTITY_NAME_MAX_LENGTH)
  @Matches(/^[^\p{Cc}]*$/u, {
    message: 'displayName must not contain control characters',
  })
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
    maxLength: ENTITY_INSTRUCTIONS_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(ENTITY_INSTRUCTIONS_MAX_LENGTH)
  prompt!: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['skills/public/daily-summary'],
    description:
      'DIAL skill references with paths of at most 1024 decoded characters each. Omission preserves saved skills on update; an empty array removes them.',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @IsValidSkillPathLength({ each: true })
  @IsValidFilePath({ each: true })
  @Matches(/^skills\/[\w.-]{1,256}\/(?=.*\S).+$/u, {
    message:
      'skillUrls must contain skills/{bucket}/{path} resource references',
    each: true,
  })
  @Matches(/^[^\p{Cc}]*$/u, { each: true })
  @Matches(/^(?!.*%(?:0[0-9a-f]|1[0-9a-f]|7f)).*$/i, { each: true })
  skillUrls?: string[];

  @ApiPropertyOptional({
    example: 'Summarizes unread inbox items every morning',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class CreatedScheduledTaskDto extends ScheduledTaskDto {}
