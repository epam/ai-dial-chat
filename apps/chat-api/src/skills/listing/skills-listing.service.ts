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
import { getSkillTransferTimeoutMs } from '../utils/skill-config.util';
import {
  type DialMetadataBase,
  mapToSkillMetadataItem,
} from '../utils/skill-metadata.util';

type DialSkillItem = DialMetadataBase & { items?: DialMetadataBase[] };

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
