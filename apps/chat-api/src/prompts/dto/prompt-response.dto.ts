import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromptResponseDto {
  @ApiProperty({
    description:
      'Full DIAL Core resource path identifying the prompt (`prompts/{bucket}/{path}`), the same shape every other resource type exposes. For a prompt shared with the caller, `bucket` is the owner bucket, not the caller bucket.',
    example: 'prompts/my-bucket/Work/AI/my-prompt',
  })
  id!: string;

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

  @ApiPropertyOptional({
    description: 'Whether the prompt belongs to the requestor',
  })
  isMy?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the requestor may update the prompt. Organisation prompts are always read-only.',
  })
  canEdit?: boolean;

  @ApiPropertyOptional({
    description: 'Whether another user shared the prompt with the requestor',
  })
  sharedWithMe?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'READ/WRITE/SHARE permissions applicable to the requestor',
  })
  permissions?: string[];
}
