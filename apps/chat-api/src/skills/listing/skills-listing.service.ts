import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { StringUtils } from '../../common/utils/string-utils';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  SkillCatalogListResponseDto,
  SkillFileListResponseDto,
  SkillListResponseDto,
  SkillMetadataItemDto,
} from '../dto/skill-metadata.dto';
import { SkillNodeType } from '../dto/skill-node-type';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  type DialMetadataBase,
  mapToSkillMetadataItem,
} from '../utils/skill-metadata.util';

type DialSkillItem = DialMetadataBase & { items?: DialMetadataBase[] };
type SharedSkillItem = DialMetadataBase & { permissions?: string[] };

const PUBLIC_BUCKET = 'public';
const CATALOG_PAGE_SIZE = 1000;
/**
 * Upstream pages one listing request consumes before answering with what it
 * has. Bounds the work a bucket full of non-skill storage objects can cost,
 * at the price of a short page in that pathological case.
 */
const MAX_UPSTREAM_PAGES_PER_REQUEST = 20;

export interface SkillListQuery {
  token?: string;
  limit?: number;
  recursive?: boolean;
}

@Injectable()
export class SkillsListingService {
  private readonly logger = new Logger(SkillsListingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private mapListing(
    bucket: string,
    path: string,
    data: DialSkillItem,
  ): SkillListResponseDto {
    const items = (data.items ?? [])
      .map(mapToSkillMetadataItem)
      .filter((item): item is SkillMetadataItemDto => item !== null);

    return {
      bucket,
      path,
      items,
      nextToken: 'nextToken' in data ? data.nextToken : undefined,
    };
  }

  /**
   * Answers one page of skills, following DIAL Core's cursor past pages that
   * hold no skill at all.
   *
   * Core's cursor walks storage objects — a version folder's `SKILL.md`, an
   * asset file, a `.dial-resource` marker — while this listing shows only
   * the skills among them, so an upstream page routinely maps to nothing.
   * Forwarded verbatim that reached a caller as an empty first page for a
   * bucket that demonstrably had content, and the common "page until a page
   * comes back empty" loop stopped there and showed nothing.
   *
   * Each upstream page asks for only the items still missing from the
   * caller's `limit`, so the walk can never answer with more than was asked
   * for, and `nextToken` continues from the last upstream page consumed.
   */
  async listSkills(
    bucket: string,
    path: string,
    query: SkillListQuery,
    accessToken: string,
  ): Promise<SkillListResponseDto> {
    const items: SkillMetadataItemDto[] = [];
    const visitedTokens = new Set<string>();
    let token = query.token;
    let nextToken: string | undefined;

    for (let page = 0; page < MAX_UPSTREAM_PAGES_PER_REQUEST; page += 1) {
      const remaining =
        query.limit == null ? undefined : query.limit - items.length;
      if (remaining != null && remaining <= 0) break;

      const upstream = await this.listSkillPage(
        bucket,
        path,
        { ...query, token, limit: remaining },
        accessToken,
      );
      items.push(...upstream.items);
      nextToken = upstream.nextToken;

      if (nextToken == null) break;
      /* A cursor that repeats would otherwise spin until the page cap. */
      if (visitedTokens.has(nextToken)) break;
      visitedTokens.add(nextToken);
      token = nextToken;

      if (query.limit == null && items.length > 0) break;
    }

    return { bucket, path, items, nextToken };
  }

  /** One upstream `listSkillMetadata` call, mapped and error-translated. */
  private async listSkillPage(
    bucket: string,
    path: string,
    query: SkillListQuery,
    accessToken: string,
  ): Promise<SkillListResponseDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.listSkillMetadata(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(accessToken),
            params: {
              query: {
                token: query.token,
                limit: query.limit,
                recursive: query.recursive ?? false,
              },
            },
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null || data == null) {
        return handleDialSdkError(
          error,
          'skills.listSkills',
          this.logger,
          response,
        );
      }

      return this.mapListing(bucket, path, data as DialSkillItem);
    } catch (err) {
      return handleDialSdkError(err, 'skills.listSkills', this.logger);
    }
  }

  /**
   * Resolves one skill's own authoritative metadata for
   * `GET /api/v1/skills/metadata` (design.md D1/D2). Unlike
   * `SkillsLookupService.resolveSkillItem`, this path never folds in
   * invitation-granted permissions and never returns `null` on a miss — a
   * caller here always wants "the metadata" or a typed error, never a
   * degrade-to-fallback signal. Ownership fields (`isMy`/`canEdit`/
   * `sharedWithMe`) are stripped from the result so fetching provenance can
   * never be mistaken for an ownership grant.
   */
  async getSkillMetadata(
    bucket: string,
    path: string,
    accessToken: string,
  ): Promise<SkillMetadataItemDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.listSkillMetadata(
          bucket,
          encodeDialResourcePath(path),
          {
            headers: getBearerAuthHeaders(accessToken),
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null || data == null) {
        return handleDialSdkError(
          error,
          'skills.getSkillMetadata',
          this.logger,
          response,
        );
      }

      const item = mapToSkillMetadataItem(data as DialMetadataBase);
      if (item == null) {
        throw new NotFoundException('Skill not found');
      }
      if (item.nodeType === SkillNodeType.Folder) {
        throw new BadRequestException(
          'Path resolves to a grouping folder, not a skill',
        );
      }

      const {
        isMy: _isMy,
        canEdit: _canEdit,
        sharedWithMe: _sharedWithMe,
        ...provenance
      } = item;
      return provenance;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      return handleDialSdkError(err, 'skills.getSkillMetadata', this.logger);
    }
  }

  private async listAllSkillItems(
    bucket: string,
    accessToken: string,
  ): Promise<SkillMetadataItemDto[]> {
    const items: SkillMetadataItemDto[] = [];
    const visitedTokens = new Set<string>();
    let token: string | undefined;

    do {
      const page = await this.listSkillPage(
        bucket,
        '',
        { recursive: true, limit: CATALOG_PAGE_SIZE, token },
        accessToken,
      );
      items.push(...page.items.filter((item) => item.nodeType === 'item'));
      token = page.nextToken;
      if (token != null) {
        if (visitedTokens.has(token)) {
          throw new Error('DIAL Core returned a repeated skill page token');
        }
        visitedTokens.add(token);
      }
    } while (token != null);

    return items;
  }

  private async listSharedSkills(
    accessToken: string,
  ): Promise<SkillMetadataItemDto[]> {
    try {
      const { data, error } = (await this.dialClient.client.getSharedResources({
        headers: getBearerAuthHeaders(accessToken),
        body: { resourceTypes: ['SKILL'], with: 'me' },
      })) as {
        data?: { resources?: SharedSkillItem[] };
        error?: unknown;
      };
      if (error != null || data == null) {
        this.logger.warn('getSharedResources (SKILL) returned an error', error);
        return [];
      }

      return (data.resources ?? [])
        .filter((item) => item.nodeType === 'ITEM')
        .map((item) => {
          if (item.url == null) return mapToSkillMetadataItem(item);

          const url = StringUtils.stripTrailingSlashes(
            safeDecodeURIComponent(item.url),
          );
          const [prefix, bucket, ...pathSegments] = url.split('/');
          if (prefix !== 'skills' || !bucket || pathSegments.length === 0) {
            return null;
          }
          const path = pathSegments.join('/');
          const name = pathSegments[pathSegments.length - 1];
          const parentPath =
            pathSegments.length > 1
              ? `${pathSegments.slice(0, -1).join('/')}/`
              : undefined;

          return mapToSkillMetadataItem({
            ...item,
            bucket,
            name,
            parentPath,
            url: `skills/${bucket}/${path}`,
          });
        })
        .filter((item): item is SkillMetadataItemDto => item != null)
        .map((item) => ({
          ...item,
          isMy: false,
          canEdit: item.permissions?.includes('WRITE') ?? false,
          sharedWithMe: true,
        }));
    } catch (err) {
      this.logger.warn('getSharedResources (SKILL) failed', err);
      return [];
    }
  }

  async listCatalogSkills(
    bucket: string,
    accessToken: string,
  ): Promise<SkillCatalogListResponseDto> {
    const [[personalResult, organisationResult], shared] = await Promise.all([
      Promise.allSettled([
        this.listAllSkillItems(bucket, accessToken),
        this.listAllSkillItems(PUBLIC_BUCKET, accessToken),
      ]),
      this.listSharedSkills(accessToken),
    ]);
    if (
      personalResult.status === 'rejected' &&
      organisationResult.status === 'rejected'
    ) {
      throw personalResult.reason;
    }
    if (personalResult.status === 'rejected') {
      this.logger.warn('Personal skill catalog listing failed');
    }
    if (organisationResult.status === 'rejected') {
      this.logger.warn('Public skill catalog listing failed');
    }

    const personal =
      personalResult.status === 'fulfilled' ? personalResult.value : [];
    const organisation =
      organisationResult.status === 'fulfilled' ? organisationResult.value : [];
    const skills = personal.map((item) => ({
      ...item,
      isMy: true,
      canEdit: true,
      sharedWithMe: false,
    }));
    const publicSkills = organisation.map((item) => ({
      ...item,
      isMy: false,
      canEdit: false,
      sharedWithMe: false,
    }));
    const listedUrls = new Set(
      [...skills, ...publicSkills].map((item) => item.url),
    );

    return {
      skills,
      publicSkills,
      sharedWithMe: shared.filter((item) => !listedUrls.has(item.url)),
    };
  }

  async listSkillFiles(
    bucket: string,
    path: string,
    filePath: string,
    query: SkillListQuery,
    accessToken: string,
  ): Promise<SkillFileListResponseDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.listSkillFileMetadata(
          bucket,
          encodeDialResourcePath(path),
          encodeDialResourcePath(filePath),
          {
            headers: getBearerAuthHeaders(accessToken),
            params: {
              query: {
                token: query.token,
                limit: query.limit,
                recursive: query.recursive ?? false,
              },
            },
            signal: AbortSignal.timeout(
              getSkillTransferTimeoutMs(this.configService),
            ),
          },
        );

      if (error != null || data == null) {
        return handleDialSdkError(
          error,
          'skills.listSkillFiles',
          this.logger,
          response,
        );
      }

      return this.mapListing(bucket, path, data as DialSkillItem);
    } catch (err) {
      return handleDialSdkError(err, 'skills.listSkillFiles', this.logger);
    }
  }
}
