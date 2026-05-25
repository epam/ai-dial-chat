import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { ApplicationsService } from '../applications/applications.service';
import type { ApplicationDto } from '../applications/dto/application.dto';
import { ModelsService } from '../models/models.service';
import {
  CatalogFilterService,
  type CatalogFilter,
} from './catalog-filter.service';
import type {
  CatalogItemDto,
  CatalogResponseDto,
} from './dto/catalog-item.dto';

const BOOLEAN_CAPABILITY_FIELDS = {
  completion: ['completion'],
  chat_completion: ['chat_completion', 'chatCompletion'],
  embeddings: ['embeddings'],
  fine_tune: ['fine_tune', 'fineTune'],
  inference: ['inference'],
} as const;

function toDisplayName(id: string, displayName?: string): string {
  return displayName || id;
}

function extractCapabilities(
  capabilities: Record<string, unknown> | undefined,
): Record<string, boolean> | undefined {
  if (!capabilities) return undefined;
  const result: Record<string, boolean> = {};
  for (const [targetKey, sourceKeys] of Object.entries(
    BOOLEAN_CAPABILITY_FIELDS,
  )) {
    for (const sourceKey of sourceKeys) {
      if (typeof capabilities[sourceKey] === 'boolean') {
        result[targetKey] = capabilities[sourceKey] as boolean;
        break;
      }
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function mapModelToItem(model: Record<string, unknown>): CatalogItemDto {
  return {
    id: model['id'] as string,
    displayName: toDisplayName(
      model['id'] as string,
      model['display_name'] as string | undefined,
    ),
    type: 'model',
    description: model['description'] as string | undefined,
    iconUrl: model['icon_url'] as string | undefined,
    maxInputAttachments: model['max_input_attachments'] as number | undefined,
    inputAttachmentTypes: model['input_attachment_types'] as
      | string[]
      | undefined,
    capabilities: extractCapabilities(
      model['capabilities'] as Record<string, unknown> | undefined,
    ),
  };
}

function mapApplicationToItem(app: ApplicationDto): CatalogItemDto {
  return {
    id: app.id,
    displayName: toDisplayName(app.id, app.display_name),
    type: 'application',
    description: app.description,
    iconUrl: app.icon_url,
    maxInputAttachments: app.max_input_attachments,
    inputAttachmentTypes: app.input_attachment_types,
  };
}

function sortCatalogItems(items: CatalogItemDto[]): CatalogItemDto[] {
  return [...items].sort((a, b) => {
    const nameCompare = a.displayName
      .toLowerCase()
      .localeCompare(b.displayName.toLowerCase());
    if (nameCompare !== 0) return nameCompare;
    return a.id.localeCompare(b.id);
  });
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly modelsService: ModelsService,
    private readonly applicationsService: ApplicationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly catalogFilterService: CatalogFilterService,
  ) {}

  async listCatalogItems(
    userSub: string,
    accessToken: string,
    filter: CatalogFilter = {},
  ): Promise<CatalogResponseDto> {
    const cacheKey = `catalog:list:${userSub}`;
    const cachedItems = await this.cacheManager.get<CatalogItemDto[]>(cacheKey);

    let sorted: CatalogItemDto[];
    if (cachedItems) {
      this.logger.debug(`Cache hit for catalog list (sub: ${userSub})`);
      sorted = cachedItems;
    } else {
      const [modelsResponse, applicationsResponse] = await Promise.all([
        this.modelsService.listModels(userSub, accessToken),
        this.applicationsService.listApplications(userSub, accessToken),
      ]);
      const modelItems = modelsResponse.data.map(mapModelToItem);
      const appItems = applicationsResponse.data.map(mapApplicationToItem);
      sorted = sortCatalogItems([...modelItems, ...appItems]);
      await this.cacheManager.set(cacheKey, sorted, 30 * 1000);
    }

    const total = sorted.length;
    const filteredItems = this.catalogFilterService.apply(sorted, filter);
    return { data: filteredItems, total, filtered: filteredItems.length };
  }
}
