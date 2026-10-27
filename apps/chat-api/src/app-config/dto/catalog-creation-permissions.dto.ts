import { ApiProperty } from '@nestjs/swagger';
import { CatalogCreationType } from '../../config/catalog-creation.types';

export class CatalogCreationPermissionsDto {
  @ApiProperty({
    description:
      'Creation types the caller may create, in the fixed order custom-app, schema-app, toolset, prompt, skill. Evaluated from CATALOG_CREATION_ROLES; a type without a rule is always present. Controls client creation workflows only.',
    enum: CatalogCreationType,
    enumName: 'CatalogCreationType',
    isArray: true,
    example: ['schema-app', 'toolset', 'prompt', 'skill'],
  })
  allowedTypes!: CatalogCreationType[];

  @ApiProperty({
    description:
      'Exact application schema ids whose CATALOG_CREATION_ROLES rule the caller fails, in configuration order. Reported independently of the schema-app type; creating a schema app requires both.',
    type: [String],
    example: ['schema-A'],
  })
  restrictedSchemaIds!: string[];
}
