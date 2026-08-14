import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import { FOLDER_SENTINEL } from '../constants/prompt.constants';
import type { PromptResponseDto } from '../dto/prompt-response.dto';
import type { PublicPromptListResponseDto } from '../dto/public-prompt-list-response.dto';
import { PromptsResourceService } from '../resource/prompts-resource.service';
import {
  deriveFolders,
  isHiddenPromptPath,
  isSentinelPath,
  mapPromptToResponse,
  metadataItemToPromptPath,
  PUBLIC_BUCKET,
  type PromptMetadataItem,
  type PromptReadResult,
} from '../utils/prompt-mapper.util';

@Injectable()
export class PromptsPublicService {
  private readonly logger = new Logger(PromptsPublicService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly resourceService: PromptsResourceService,
  ) {}

  async listPublicPrompts(token: string): Promise<PublicPromptListResponseDto> {
    try {
      const items = await this.resourceService.listPromptMetadataItems(
        token,
        PUBLIC_BUCKET,
        '',
      );

      const promptItems = items
        .map((item) => ({
          item,
          path: metadataItemToPromptPath(item, PUBLIC_BUCKET),
        }))
        .filter(
          (entry): entry is { item: PromptMetadataItem; path: string } =>
            entry.path != null &&
            !isSentinelPath(entry.path) &&
            !isHiddenPromptPath(entry.path),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToPromptPath(item, PUBLIC_BUCKET))
        .filter((path): path is string => path != null && isSentinelPath(path))
        .map((path) => path.slice(0, -`/${FOLDER_SENTINEL}`.length))
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptItems.map(({ item, path }) =>
            this.resourceService.readPromptByPath(
              token,
              PUBLIC_BUCKET,
              path,
              item,
            ),
          ),
        )
      ).filter((p): p is PromptResponseDto => p != null);

      const folders = deriveFolders([
        ...prompts.map((p) => p.id),
        ...sentinelFolderIds.map((folderId) => `${folderId}/placeholder`),
      ]);

      return { prompts, folders };
    } catch (err) {
      this.logger.error('DIAL Core listPublicPrompts failed', err);
      return handleDialSdkError(err, 'prompts.listPublicPrompts', this.logger);
    }
  }

  async getPublicPrompt(
    token: string,
    path: string,
  ): Promise<PromptResponseDto> {
    const { data, error, response } = (await this.dialClient.client.getPrompt(
      PUBLIC_BUCKET,
      encodeDialResourcePath(path),
      { headers: getBearerAuthHeaders(token) },
    )) as PromptReadResult;

    if (error != null || data == null) {
      this.logger.debug(
        `getPublicPrompt rejected — path: ${path}, status: ${response?.status}`,
      );
      return handleDialSdkError(
        error,
        'prompts.getPublicPrompt',
        this.logger,
        response,
      );
    }

    const metadata = await this.resourceService.getPromptMetadataItem(
      token,
      PUBLIC_BUCKET,
      path,
    );
    if (metadata == null) {
      throw new NotFoundException(`Public prompt metadata not found: ${path}`);
    }
    return mapPromptToResponse(data, path, metadata, PUBLIC_BUCKET);
  }
}
