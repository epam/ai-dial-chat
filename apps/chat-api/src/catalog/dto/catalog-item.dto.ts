import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CatalogItemDto {
  @ApiProperty({ example: 'gpt-4o' })
  id!: string;

  @ApiProperty({ example: 'GPT-4o' })
  displayName!: string;

  @ApiProperty({ enum: ['model', 'application'], example: 'model' })
  type!: 'model' | 'application';

  @ApiPropertyOptional({ example: 'A powerful multimodal model.' })
  description?: string;

  @ApiPropertyOptional({ example: 'GPT4o.svg' })
  iconUrl?: string;

  @ApiPropertyOptional({ example: 5 })
  maxInputAttachments?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['image/png', 'application/pdf'],
  })
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'boolean' },
    example: { chat_completion: true, embeddings: false, completion: false },
    description:
      'Boolean capability flags from DIAL Core (model items only). scale_types is excluded.',
  })
  capabilities?: Record<string, boolean>;
}

export class CatalogResponseDto {
  @ApiProperty({ type: () => [CatalogItemDto] })
  data!: CatalogItemDto[];

  @ApiProperty({ example: 42, description: 'Total count before filtering' })
  total!: number;

  @ApiProperty({ example: 10, description: 'Count of items after filtering' })
  filtered!: number;
}
