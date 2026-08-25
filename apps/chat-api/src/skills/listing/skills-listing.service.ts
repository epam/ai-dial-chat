import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  SkillCatalogListResponseDto,
  SkillFileListResponseDto,
  SkillListResponseDto,
  SkillMetadataItemDto,
} from '../dto/skill-metadata.dto';
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  type DialMetadataBase,
  mapToSkillMetadataItem,
} from '../utils/skill-metadata.util';

type DialSkillItem = DialMetadataBase & { items?: DialMetadataBase[] };
type SharedSkillItem = DialMetadataBase & { permissions?: string[] };

const PUBLIC_BUCKET = 'public';
const CATALOG_PAGE_SIZE = 1000;

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

  async listSkills(
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

  private async listAllSkillItems(
    bucket: string,
    accessToken: string,
  ): Promise<SkillMetadataItemDto[]> {
    const items: SkillMetadataItemDto[] = [];
    const visitedTokens = new Set<string>();
    let token: string | undefined;

    do {
      const page = await this.listSkills(
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

          const url = safeDecodeURIComponent(item.url).replace(/\/+$/, '');
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
