import type { components } from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../../dial/dial-client.service';
import type {
  SkillFileListResponseDto,
  SkillListResponseDto,
  SkillMetadataItemDto,
} from '../dto/skill-metadata.dto';
import { SkillNodeType } from '../dto/skill-node-type';

type DialMetadataBase = components['schemas']['MetadataBase'];
type DialSkillItem = DialMetadataBase & { items?: DialMetadataBase[] };

export interface SkillListQuery {
  token?: string;
  limit?: number;
  recursive?: boolean;
}

/**
 * Maps DIAL Core's `MetadataBase` (`ResourceFolderMetadata |
 * ResourceItemMetadata`, discriminated by `nodeType: 'FOLDER' | 'ITEM'`)
 * into a normalized `SkillMetadataItemDto`, lowercasing `nodeType` to match
 * `ListFilesItemDto`'s existing normalization convention. Malformed
 * upstream metadata with no recognizable `nodeType` is skipped rather than
 * throwing, since a single bad entry should not fail the whole listing.
 */
const mapToSkillMetadataItem = (
  item: DialMetadataBase,
): SkillMetadataItemDto | null => {
  const nodeType =
    item.nodeType === 'FOLDER'
      ? SkillNodeType.Folder
      : item.nodeType === 'ITEM'
        ? SkillNodeType.Item
        : null;
  if (nodeType == null || item.bucket == null || item.name == null) {
    return null;
  }

  const path =
    item.parentPath != null ? `${item.parentPath}${item.name}` : item.name;

  return {
    name: item.name,
    path: nodeType === SkillNodeType.Folder ? `${path}/` : path,
    url: item.url ?? `skills/${item.bucket}/${path}`,
    bucket: item.bucket,
    nodeType,
    parentPath: item.parentPath,
    permissions: item.permissions,
    etag: 'etag' in item ? item.etag : undefined,
    author: 'author' in item ? item.author : undefined,
    createdAt: 'createdAt' in item ? item.createdAt : undefined,
    updatedAt: 'updatedAt' in item ? item.updatedAt : undefined,
  };
};

@Injectable()
export class SkillsListingService {
  private readonly logger = new Logger(SkillsListingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  private getTimeoutMs(): number {
    return (
      this.configService.get<number>('SKILL_TRANSFER_TIMEOUT_MS') ?? 60_000
    );
  }

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
            signal: AbortSignal.timeout(this.getTimeoutMs()),
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
            signal: AbortSignal.timeout(this.getTimeoutMs()),
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
