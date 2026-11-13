import type { components } from '@epam/ai-dial-typescript-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { withCachedDialRequest } from '../dial/cached-dial-request.helper';
import { DialClientService } from '../dial/dial-client.service';
import type { OrgUnitDto, OrgUnitsResponseDto } from './dto/org-unit.dto';

/** The shared space every org unit lives under. */
const ORG_UNITS_ROOT = 'public';
const CACHE_TTL_MS = 60 * 1000;
const NOT_FOUND = 404;
const CONTEXT = 'list org units';

const DISABLED: OrgUnitsResponseDto = { enabled: false, units: [] };

type CoreOrgUnitItem = components['schemas']['OrgUnitDataSummary'];

@Injectable()
export class OrgUnitsService {
  private readonly logger = new Logger(OrgUnitsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * The org units DIAL Core shows the caller (all of them for a DIAL admin),
   * flattened parents-first. Core answers 404 while org units are off; that is
   * a deployment state, not a failure, so it becomes `enabled: false`.
   */
  async listOrgUnits(
    userSub: string,
    accessToken: string,
  ): Promise<OrgUnitsResponseDto> {
    return withCachedDialRequest({
      cacheManager: this.cacheManager,
      cacheKey: `org-units:list:${userSub}`,
      ttlMs: CACHE_TTL_MS,
      context: CONTEXT,
      logger: this.logger,
      fetch: async () => {
        const result = await this.dialClient.client.getOrgUnit(ORG_UNITS_ROOT, {
          params: { query: { recursive: true } },
          headers: getBearerAuthHeaders(accessToken),
        });
        if (result.error) {
          if (result.response.status === NOT_FOUND) return DISABLED;
          return mapDialHttpStatus(
            result.response.status,
            CONTEXT,
            this.logger,
          );
        }
        /* A preview API: tolerate a body without an `items` array instead of failing the list. */
        const rawItems = result.data?.items;
        const items = Array.isArray(rawItems) ? rawItems : [];
        return {
          enabled: true,
          units: items.flatMap((item) => this.toDto(item)),
        };
      },
    });
  }

  private toDto(item: CoreOrgUnitItem): OrgUnitDto[] {
    const { id, name, displayName, path, folder } = item;
    if (!id || !name || !path || !folder) {
      this.logger.warn(
        `Dropping a DIAL Core org unit without id, name, path or folder (id: ${id ?? 'none'})`,
      );
      return [];
    }
    return [{ id, name, displayName: displayName || name, path, folder }];
  }
}
