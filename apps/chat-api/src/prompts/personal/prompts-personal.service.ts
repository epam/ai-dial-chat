import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { FOLDER_SENTINEL } from '../constants/prompt.constants';
import type { CreatePromptDto } from '../dto/create-prompt.dto';
import type { PromptListResponseDto } from '../dto/prompt-list-response.dto';
import type { PromptResponseDto } from '../dto/prompt-response.dto';
import type { UpdatePromptDto } from '../dto/update-prompt.dto';
import { PromptsResourceService } from '../resource/prompts-resource.service';
import {
  deriveFolders,
  folderIdFromId,
  isHiddenPromptPath,
  isSentinelPath,
  mapPromptToResponse,
  metadataItemToPromptPath,
  nameFromId,
  PROMPT_RESOURCE_PREFIX,
  type PromptMetadataItem,
  type PromptPayload,
  type PromptReadResult,
  type PromptWriteResult,
  type SharedResourcesResult,
} from '../utils/prompt-mapper.util';

@Injectable()
export class PromptsPersonalService {
  private readonly logger = new Logger(PromptsPersonalService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly resourceService: PromptsResourceService,
  ) {}

  async listPrompts(
    token: string,
    bucket: string,
  ): Promise<PromptListResponseDto> {
    try {
      const items = await this.resourceService.listPromptMetadataItems(
        token,
        bucket,
        '',
      );

      const promptItems = items
        .map((item) => ({
          item,
          path: metadataItemToPromptPath(item, bucket),
        }))
        .filter(
          (entry): entry is { item: PromptMetadataItem; path: string } =>
            entry.path != null &&
            !isSentinelPath(entry.path) &&
            !isHiddenPromptPath(entry.path),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToPromptPath(item, bucket))
        .filter((path): path is string => path != null && isSentinelPath(path))
        .map((path) => path.slice(0, -`/${FOLDER_SENTINEL}`.length))
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptItems.map(({ item, path }) =>
            this.resourceService.readPromptByPath(token, bucket, path, item),
          ),
        )
      ).filter((p): p is PromptResponseDto => p != null);

      const folders = deriveFolders([
        ...prompts.map((p) => p.id),
        ...sentinelFolderIds.map((folderId) => `${folderId}/placeholder`),
      ]);
      const sharedWithMe = await this.getSharedPrompts(token, bucket);

      return { prompts, folders, sharedWithMe };
    } catch (err) {
      this.logger.error('DIAL Core listPrompts failed', err);
      return handleDialSdkError(err, 'prompts.listPrompts', this.logger);
    }
  }

  async getSharedPrompts(
    token: string,
    _bucket: string,
  ): Promise<PromptResponseDto[]> {
    try {
      const { data, error } = (await this.dialClient.client.getSharedResources({
        headers: getBearerAuthHeaders(token),
        body: { resourceTypes: ['PROMPT'], with: 'me' },
      })) as SharedResourcesResult;

      if (error != null || data == null) {
        this.logger.warn('getSharedResources (PROMPT) returned error', error);
        return [];
      }

      const sharedItems = (data.resources ?? []).filter(
        (r) => r.nodeType !== 'FOLDER',
      );

      const results = await Promise.all(
        sharedItems.map((item) => {
          const raw =
            item.url ??
            (item.parentPath != null && item.name != null
              ? `${item.parentPath}/${item.name}`
              : null);

          if (raw == null) return Promise.resolve(null);

          /* URL format: 'prompts/{ownerBucket}/{path}' */
          const decoded = safeDecodeURIComponent(raw);
          const parts = decoded.split('/');
          if (parts.length < 3 || parts[0] !== PROMPT_RESOURCE_PREFIX)
            return Promise.resolve(null);

          const ownerBucket = parts[1];
          const path = parts.slice(2).join('/');

          if (isHiddenPromptPath(path)) return Promise.resolve(null);

          return this.resourceService.readPromptByPath(
            token,
            ownerBucket,
            path,
          );
        }),
      );

      return results.filter((p): p is PromptResponseDto => p != null);
    } catch (err) {
      this.logger.warn('getSharedPrompts failed', err);
      return [];
    }
  }

  async getPrompt(
    token: string,
    bucket: string,
    path: string,
  ): Promise<PromptResponseDto> {
    const { data, error, response } = (await this.dialClient.client.getPrompt(
      bucket,
      encodeDialResourcePath(path),
      { headers: getBearerAuthHeaders(token) },
    )) as PromptReadResult;

    if (error != null || data == null) {
      this.logger.debug(
        `getPrompt rejected — bucket: ${bucket}, path: ${path}, status: ${response?.status}`,
      );
      return handleDialSdkError(
        error,
        'prompts.getPrompt',
        this.logger,
        response,
      );
    }

    const metadata = await this.resourceService.getPromptMetadataItem(
      token,
      bucket,
      path,
    );
    if (metadata == null) {
      throw new NotFoundException(`Prompt metadata not found: ${path}`);
    }
    return mapPromptToResponse(data, path, metadata);
  }

  async createPrompt(
    token: string,
    bucket: string,
    dto: CreatePromptDto,
  ): Promise<PromptResponseDto> {
    const id = dto.folderId ? `${dto.folderId}/${dto.name}` : dto.name;
    const prompt: PromptPayload = {
      id,
      name: dto.name,
      description: dto.description,
      content: dto.content,
      folderId: dto.folderId ?? '',
    };

    const metadata = await this.resourceService.savePromptResource(
      token,
      bucket,
      id,
      prompt,
      'prompts.createPrompt',
      true,
    );
    return mapPromptToResponse(prompt, id, metadata);
  }

  async updatePrompt(
    token: string,
    bucket: string,
    path: string,
    dto: UpdatePromptDto,
  ): Promise<PromptResponseDto> {
    const {
      data: existing,
      error: readError,
      response: readResponse,
    } = (await this.dialClient.client.getPrompt(
      bucket,
      encodeDialResourcePath(path),
      { headers: getBearerAuthHeaders(token) },
    )) as PromptReadResult;

    if (readError != null || existing == null) {
      this.logger.debug(
        `updatePrompt read failed — bucket: ${bucket}, path: ${path}, status: ${readResponse?.status}`,
      );
      return handleDialSdkError(
        readError,
        'prompts.updatePrompt',
        this.logger,
        readResponse,
      );
    }

    const currentName = nameFromId(path);
    const newName = dto.name !== undefined ? dto.name : currentName;
    const isRename = newName !== currentName;

    const currentFolderId = folderIdFromId(path);
    let targetId: string;
    if (!isRename) {
      targetId = path;
    } else if (currentFolderId) {
      targetId = `${currentFolderId}/${newName}`;
    } else {
      targetId = newName;
    }
    const updatedPrompt: PromptPayload = {
      ...existing,
      id: targetId,
      name: newName,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      content: dto.content !== undefined ? dto.content : existing.content,
      folderId: folderIdFromId(targetId),
    };

    const metadata = await this.resourceService.savePromptResource(
      token,
      bucket,
      targetId,
      updatedPrompt,
      'prompts.updatePrompt',
      isRename,
    );

    if (isRename) {
      const { error: deleteError, response: deleteResponse } =
        (await this.dialClient.client.deletePrompt(
          bucket,
          encodeDialResourcePath(path),
          { headers: getBearerAuthHeaders(token) },
        )) as PromptWriteResult;

      if (deleteError != null) {
        return handleDialSdkError(
          deleteError,
          'prompts.updatePrompt.deleteSource',
          this.logger,
          deleteResponse,
        );
      }
    }

    return mapPromptToResponse(updatedPrompt, targetId, metadata);
  }

  async deletePrompt(
    token: string,
    bucket: string,
    path: string,
  ): Promise<void> {
    const metadata = await this.resourceService.getPromptMetadataItem(
      token,
      bucket,
      path,
    );
    if (metadata == null) {
      throw new NotFoundException(`Prompt not found: ${path}`);
    }

    const { error, response } = (await this.dialClient.client.deletePrompt(
      bucket,
      encodeDialResourcePath(path),
      { headers: getBearerAuthHeaders(token) },
    )) as PromptWriteResult;

    if (error != null) {
      this.logger.error('DIAL Core rejected deletePrompt', error);
      handleDialSdkError(error, 'prompts.deletePrompt', this.logger, response);
    }
  }
}
