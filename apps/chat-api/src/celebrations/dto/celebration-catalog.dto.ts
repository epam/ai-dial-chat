import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

/** A reference to one pack version. */
export class CelebrationPackRefDto {
  @ApiProperty({
    description: 'Pack ID, lowercase kebab-case.',
    example: 'new-year-default',
  })
  packId!: string;

  @ApiProperty({
    description: 'Pack version, strict semver.',
    example: '1.0.0',
  })
  version!: string;
}

/** One pack version the celebration index lists. */
export class CelebrationCatalogPackDto extends CelebrationPackRefDto {
  @ApiProperty({
    description: 'Celebration event the pack belongs to.',
    example: 'new-year',
  })
  eventId!: string;
}

/* CelebrationPackRefDto is reachable only through an additionalProperties
 * $ref, which Swagger does not follow when collecting schemas. */
@ApiExtraModels(CelebrationPackRefDto)
export class CelebrationCatalogDto {
  @ApiProperty({
    description: 'Schema version of the published celebration index.',
    example: 1,
  })
  schemaVersion!: number;

  @ApiProperty({
    description:
      'Catalog revision. Changes whenever the published index changes; every pack resolved from this index reports it as catalogRevision.',
    example: '2026-11-15.1',
  })
  revision!: string;

  @ApiProperty({
    description: 'Every published pack version, in index order.',
    type: [CelebrationCatalogPackDto],
  })
  packs!: CelebrationCatalogPackDto[];

  @ApiProperty({
    description:
      'Default pack per event ID. Each value names a listed pack whose eventId equals the key; invalid entries are dropped.',
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(CelebrationPackRefDto) },
    example: { 'new-year': { packId: 'new-year-default', version: '1.0.0' } },
  })
  defaults!: Record<string, CelebrationPackRefDto>;
}
