import { Injectable } from '@nestjs/common';
import type { CatalogItemDto } from './dto/catalog-item.dto';
import type { CatalogQueryDto } from './dto/catalog-query.dto';

const CAPABILITY_FIELDS = {
  'modelCapabilities.completion': 'completion',
  'modelCapabilities.chat_completion': 'chat_completion',
  'modelCapabilities.embeddings': 'embeddings',
  'modelCapabilities.fine_tune': 'fine_tune',
  'modelCapabilities.inference': 'inference',
} as const;

type CapabilityField =
  (typeof CAPABILITY_FIELDS)[keyof typeof CAPABILITY_FIELDS];

export interface CatalogFilter {
  capabilities?: Partial<Record<CapabilityField, boolean>>;
}

export const capabilitiesFilter = (
  item: CatalogItemDto,
  filter: CatalogFilter,
): boolean => {
  const capabilities = filter.capabilities;
  if (!capabilities || Object.keys(capabilities).length === 0) return true;
  if (item.type === 'application') return true;
  const caps = item.capabilities ?? {};
  return Object.entries(capabilities).every(
    ([capability, expected]) => caps[capability] === expected,
  );
};

@Injectable()
export class CatalogFilterService {
  parse(dto: CatalogQueryDto): CatalogFilter {
    const capabilities: Partial<Record<CapabilityField, boolean>> = {};
    for (const [queryField, capabilityField] of Object.entries(
      CAPABILITY_FIELDS,
    )) {
      const value = dto[queryField as keyof CatalogQueryDto];
      if (value !== undefined) {
        capabilities[capabilityField] = value;
      }
    }
    return Object.keys(capabilities).length > 0 ? { capabilities } : {};
  }

  apply(items: CatalogItemDto[], filter: CatalogFilter): CatalogItemDto[] {
    return items.filter((item) => capabilitiesFilter(item, filter));
  }
}
