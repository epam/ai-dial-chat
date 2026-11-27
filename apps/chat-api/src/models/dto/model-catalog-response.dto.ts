import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { ModelCatalogPropertiesDto } from '../../deployments/dto/deployment-details.dto';
import { DialModelDto } from '../../openapi/openapi-response.dto';

/**
 * The `DialModelDto` fields the model catalog copies from Core as sent. The
 * catalog shows models the caller cannot use, so it carries display data only:
 * invocation settings (`defaults`, `responses_defaults`, `max_retry_attempts`,
 * `tokenizer_model`), `catalog_schema_id` and any field Core adds later are
 * dropped. The same list drives the runtime copy and the Swagger schema, so the
 * two cannot drift. `catalog_properties` and `supportedInterfaces` are
 * separately projected, not copied, and `ModelCatalogEntryDto` declares them.
 */
export const MODEL_CATALOG_ENTRY_FIELDS = [
  'id',
  'object',
  'model',
  'display_name',
  'display_version',
  'icon_url',
  'description',
  'description_keywords',
  'reference',
  'owner',
  'status',
  'lifecycle_status',
  'provider',
  'deprecation_date',
  'end_of_service',
  'created_at',
  'updated_at',
  'features',
  'capabilities',
  'input_attachment_types',
  'max_input_attachments',
  'limits',
  'pricing',
  'interfaces',
] as const satisfies readonly (keyof DialModelDto)[];

export class ModelCatalogEntryDto extends PickType(
  DialModelDto,
  MODEL_CATALOG_ENTRY_FIELDS,
) {
  @ApiPropertyOptional({
    type: () => ModelCatalogPropertiesDto,
    description:
      'Known model catalog properties allow-listed from DIAL Core catalog_properties',
  })
  catalog_properties?: ModelCatalogPropertiesDto;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Normalized supported API names from DIAL Core declarations, with legacy OpenAI fallback when metadata is unavailable; no interface defaults or headers',
    example: ['openaiChatCompletions', 'openaiResponses', 'anthropicMessages'],
  })
  supportedInterfaces?: string[];
}

export class ModelCatalogListResponseDto {
  @ApiProperty({ type: () => [ModelCatalogEntryDto] })
  data!: ModelCatalogEntryDto[];
}
