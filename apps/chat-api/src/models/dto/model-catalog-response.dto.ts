import { ApiProperty, PickType } from '@nestjs/swagger';
import { DialModelDto } from '../../openapi/openapi-response.dto';

/**
 * The `DialModelDto` fields the model catalog returns. The catalog shows models
 * the caller cannot use, so it carries display data only: invocation settings
 * (`defaults`, `responses_defaults`, `max_retry_attempts`, `tokenizer_model`)
 * and any field Core adds later are dropped. The same list drives the runtime
 * projection and the Swagger schema, so the two cannot drift.
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
) {}

export class ModelCatalogListResponseDto {
  @ApiProperty({ type: () => [ModelCatalogEntryDto] })
  data!: ModelCatalogEntryDto[];
}
