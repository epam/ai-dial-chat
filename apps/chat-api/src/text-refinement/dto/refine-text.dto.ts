import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';

export enum TextRefinementPurpose {
  SkillDescription = 'skill-description',
  SkillInstructions = 'skill-instructions',
  ScheduledTaskDescription = 'scheduled-task-description',
  ScheduledTaskInstructions = 'scheduled-task-instructions',
}

export const TEXT_REFINEMENT_LIMITS: Record<TextRefinementPurpose, number> = {
  [TextRefinementPurpose.SkillDescription]: 4000,
  [TextRefinementPurpose.SkillInstructions]: 32000,
  [TextRefinementPurpose.ScheduledTaskDescription]: 500,
  [TextRefinementPurpose.ScheduledTaskInstructions]: 32000,
};

export class RefineTextRequestDto {
  @ApiProperty({
    enum: TextRefinementPurpose,
    enumName: 'TextRefinementPurpose',
    description: 'Server-owned rewriting purpose',
    example: TextRefinementPurpose.SkillDescription,
  })
  @IsEnum(TextRefinementPurpose)
  purpose!: TextRefinementPurpose;

  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 32000,
    description:
      'Exact nonblank draft. Unicode code point limits: skill Description 4000, task Description 500, either Instructions 32000.',
    example: 'Use this skill to explain project documentation.',
  })
  @IsString()
  @Matches(/\S/u, { message: 'text must contain non-whitespace characters' })
  @MaxLength(32000)
  text!: string;
}

export class RefineTextResponseDto {
  @ApiProperty({
    type: String,
    minLength: 1,
    maxLength: 32000,
    description:
      'Complete refined draft, bounded by the same purpose-specific Unicode limits as the input.',
    example:
      'Use this skill when you need an explanation of the project documentation.',
  })
  text!: string;
}
