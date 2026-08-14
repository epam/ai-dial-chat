import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptResponseDto {
  @ApiProperty({
    description: 'Prompt path within the prompts namespace (used as stable ID)',
    example: 'Work/AI/my-prompt',
  })
  id!: string;

  @ApiProperty({
    description:
      'DIAL Core bucket the prompt lives in. For a prompt shared with the caller this is the owner bucket, not the caller bucket, so `id` can be qualified back into a `prompts/{bucket}/{id}` resource url',
    example: 'my-bucket',
  })
  bucket!: string;

  @ApiProperty({ description: 'Display name', example: 'My Prompt' })
  name!: string;

  @ApiPropertyOptional({ description: 'Optional description', maxLength: 2000 })
  description?: string;

  @ApiProperty({ description: 'Prompt text content', maxLength: 50000 })
  content!: string;

  @ApiProperty({
    description: 'Parent folder path; empty string means root',
    example: 'Work/AI',
  })
  folderId!: string;

  @ApiPropertyOptional({
    description: 'Resource author reported by DIAL Core, when it is known',
    example: 'john.doe@example.com',
  })
  author?: string;

  @ApiProperty({
    description: 'Creation timestamp (Unix ms)',
    example: 1700000000000,
  })
  createdAt!: number;

  @ApiProperty({
    description: 'Last update timestamp (Unix ms)',
    example: 1700000001000,
  })
  updatedAt!: number;
}
