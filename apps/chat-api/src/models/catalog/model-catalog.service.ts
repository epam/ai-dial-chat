import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  handleDialFetchError,
  mapDialHttpStatus,
} from '../../common/dial/dial-error.mapper';
import { getApiKeyAuthHeaders } from '../../common/utils/auth-header';
import { EnvironmentVariables } from '../../config/environment.config';
import { mapCatalogProperties } from '../../deployments/utils/deployment-mapper.util';
import { DialClientService } from '../../dial/dial-client.service';
import {
  MODEL_CATALOG_ENTRY_FIELDS,
  type ModelCatalogEntryDto,
  type ModelCatalogListResponseDto,
} from '../dto/model-catalog-response.dto';
import { resolveModelCatalogApiKey } from './model-catalog-key';

export const MODEL_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

const LIST_CONTEXT = 'list model catalog';
const KEY_REJECTED_STATUSES = new Set([401, 403]);

interface CatalogCacheEntry {
  value: ModelCatalogListResponseDto;
  expiresAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

/* Copies only the display fields, so invocation settings and any field Core
 * adds later never reach users who cannot use the model. `catalog_properties`
 * goes through the same allowlist as `/deployments/details` and is left out
 * when nothing recognised remains. */
const toCatalogEntry = (
  model: Record<string, unknown>,
): ModelCatalogEntryDto => {
  const entry: Record<string, unknown> = {};
  for (const field of MODEL_CATALOG_ENTRY_FIELDS) {
    if (model[field] !== undefined) {
      entry[field] = model[field];
    }
  }
  const catalogProperties = mapCatalogProperties(model.catalog_properties);
  if (catalogProperties) {
    entry.catalog_properties = catalogProperties;
  }
  return entry as unknown as ModelCatalogEntryDto;
};

/**
 * Lists the DIAL Core models visible to the server-side
 * `MODEL_CATALOG_API_KEY`, for display to any signed-in user. The service owns
 * its one cache entry instead of using the shared `CACHE_MANAGER`, whose
 * 100-entry LRU would let per-user entries evict it before the TTL. Concurrent
 * cache misses share one Core request.
 */
@Injectable()
export class ModelCatalogService {
  private readonly logger = new Logger(ModelCatalogService.name);
  private cached: CatalogCacheEntry | null = null;
  private inFlight: Promise<ModelCatalogListResponseDto> | null = null;

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  async listCatalog(): Promise<ModelCatalogListResponseDto> {
    const apiKey = resolveModelCatalogApiKey(this.configService);
    if (!apiKey) {
      throw new NotFoundException('Model catalog is not configured');
    }

    if (this.cached && this.cached.expiresAt > Date.now()) {
      this.logger.debug(`Cache hit for ${LIST_CONTEXT}`);
      return this.cached.value;
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    const request = this.loadCatalog(apiKey);
    this.inFlight = request;
    try {
      return await request;
    } finally {
      if (this.inFlight === request) {
        this.inFlight = null;
      }
    }
  }

  /**
   * Resolves one model from the cached catalog list. It deliberately never
   * calls Core `GET /openai/models/{name}`: Core answers 403 for a model the
   * key cannot see, which would reveal that the hidden model exists.
   */
  async getCatalogEntry(modelName: string): Promise<ModelCatalogEntryDto> {
    const { data } = await this.listCatalog();
    const entry = data.find((model) => model.id === modelName);
    if (!entry) {
      throw new NotFoundException('Model not found');
    }
    return entry;
  }

  private async loadCatalog(
    apiKey: string,
  ): Promise<ModelCatalogListResponseDto> {
    try {
      const value = await this.fetchCatalog(apiKey);
      this.cached = {
        value,
        expiresAt: Date.now() + MODEL_CATALOG_CACHE_TTL_MS,
      };
      return value;
    } catch (err) {
      return handleDialFetchError(err, LIST_CONTEXT, this.logger);
    }
  }

  private async fetchCatalog(
    apiKey: string,
  ): Promise<ModelCatalogListResponseDto> {
    const result = await this.dialClient.client.getModels({
      headers: getApiKeyAuthHeaders(apiKey),
    });
    if (!result.response.ok || result.error != null) {
      const { status } = result.response;
      /* A 401/403 here means the server's key is invalid, revoked or
       * under-privileged — never the user's session. Passing it through would
       * make the frontend's unauthorized middleware sign the user out. */
      if (KEY_REJECTED_STATUSES.has(status)) {
        this.logger.error(
          `DIAL Core rejected the model catalog key (${status})`,
        );
        throw new ServiceUnavailableException('Model catalog is unavailable');
      }
      return mapDialHttpStatus(status, LIST_CONTEXT, this.logger);
    }

    /* The body is shared by every user for the whole TTL, so a malformed one
     * is rejected here instead of being cached. */
    const body: unknown = result.data;
    const models = isRecord(body) ? body.data : undefined;
    if (!Array.isArray(models)) {
      this.logger.error(
        `DIAL Core returned no model array for ${LIST_CONTEXT}`,
      );
      throw new BadGatewayException('Unexpected response from DIAL Core');
    }

    const entries = models.filter(
      (model): model is Record<string, unknown> =>
        isRecord(model) && typeof model.id === 'string',
    );
    if (entries.length !== models.length) {
      this.logger.warn(
        `Dropped ${models.length - entries.length} model catalog entries without a string id`,
      );
    }
    return { data: entries.map(toCatalogEntry) };
  }
}
