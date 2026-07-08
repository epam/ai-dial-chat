import { ApiProperty } from '@nestjs/swagger';

export class GenerateTitleResponseDto {
  @ApiProperty({
    description:
      'Sanitised LLM-generated title suggestion for the conversation. Not persisted — the caller confirms the rename separately.',
    example: 'Refactoring the auth module',
  })
  name!: string;
}
