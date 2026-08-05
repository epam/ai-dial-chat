import type { components } from '@epam/ai-dial-typescript-sdk';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { encodeDialResourcePath } from '../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { DialClientService } from '../dial/dial-client.service';
import { FOLDER_SENTINEL } from './constants/prompt.constants';
import type { CreatePromptFolderDto } from './dto/create-prompt-folder.dto';
import type { CreatePromptDto } from './dto/create-prompt.dto';
import type { MovePromptDto } from './dto/move-prompt.dto';
import type { PromptFolderResponseDto } from './dto/prompt-folder-response.dto';
import type { PromptListResponseDto } from './dto/prompt-list-response.dto';
import type { PromptResponseDto } from './dto/prompt-response.dto';
import type { PublicPromptListResponseDto } from './dto/public-prompt-list-response.dto';
import type { RenamePromptFolderDto } from './dto/rename-prompt-folder.dto';
import type { UpdatePromptDto } from './dto/update-prompt.dto';

const PUBLIC_BUCKET = 'public';

/* Prompt payload stored in DIAL Core. Timestamps remain resource metadata. */
type CorePrompt = components['schemas']['Prompt'];
type PromptMetadataItem = components['schemas']['ResourceItemMetadata'];
type PromptMetadataFolder = components['schemas']['ResourceFolderMetadata'];

type PromptPayload = CorePrompt & {
  description?: string;
};

interface PromptMetadataListResult {
  data?: PromptMetadataFolder;
  error?: unknown;
  response?: globalThis.Response;
}

interface PromptReadResult {
  data?: PromptPayload;
  error?: unknown;
  response?: globalThis.Response;
}

interface PromptWriteResult {
  data?: PromptMetadataItem;
  error?: unknown;
  response?: globalThis.Response;
}

interface SharedResourceItem {
  nodeType?: string;
  url?: string;
  name?: string;
  parentPath?: string;
}

interface SharedResourcesResult {
  data?: { resources?: SharedResourceItem[] };
  error?: unknown;
}

/* ---- path helpers ---- */

const folderIdFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? '' : id.slice(0, lastSlash);
};

const nameFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? id : id.slice(lastSlash + 1);
};

const isSentinelPath = (path: string): boolean =>
  path === FOLDER_SENTINEL || path.endsWith(`/${FOLDER_SENTINEL}`);

/* Parses a full DIAL resource URL back to the SDK-relative prompt path. */
const urlToPromptPath = (url: string, bucket: string): string | null => {
  const decoded = safeDecodeURIComponent(url);
  const prefix = `prompts/${bucket}/`;
  return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : null;
};

const metadataItemToPromptPath = (
  item: PromptMetadataItem,
  bucket: string,
): string | null => {
  const raw =
    item.url ??
    (item.parentPath != null && item.name != null
      ? `${item.parentPath}/${item.name}`
      : null);
  return raw != null ? urlToPromptPath(raw, bucket) : null;
};

const mapPromptToResponse = (
  prompt: PromptPayload,
  id: string,
  metadata: PromptMetadataItem,
): PromptResponseDto => ({
  id,
  name: prompt.name ?? nameFromId(id),
  description: prompt.description,
  content: prompt.content ?? '',
  folderId: prompt.folderId ?? folderIdFromId(id),
  createdAt: metadata.createdAt ?? 0,
  updatedAt: metadata.updatedAt ?? 0,
});

const deriveFolders = (promptIds: string[]): PromptFolderResponseDto[] => {
  const folderSet = new Set<string>();
  for (const id of promptIds) {
    let parent = folderIdFromId(id);
    while (parent !== '') {
      folderSet.add(parent);
      parent = folderIdFromId(parent);
    }
  }
  return [...folderSet].sort().map((folderPath) => ({
    id: folderPath,
    name: nameFromId(folderPath),
  }));
};

@Injectable()
export class PromptService {
  private readonly logger = new Logger(PromptService.name);

  constructor(private readonly dialClient: DialClientService) {}

  /* ---- private helpers ---- */

  private async getPromptMetadataItem(
    token: string,
    bucket: string,
    path: string,
  ): Promise<PromptMetadataItem | null> {
    try {
      const { data, error, response } =
        (await this.dialClient.client.getPromptMetadata(
          bucket,
          encodeDialResourcePath(path),
          { headers: getBearerAuthHeaders(token) },
        )) as PromptWriteResult;

      if (response?.status === 404) {
        return null;
      }
      if (error != null || data?.nodeType !== 'ITEM') {
        return handleDialSdkError(
          error ?? new Error('DIAL Core returned invalid prompt metadata'),
          'prompts.getMetadata',
          this.logger,
          response,
        );
      }
      return data;
    } catch (err) {
      return handleDialSdkError(err, 'prompts.getMetadata', this.logger);
    }
  }

  private async savePromptResource(
    token: string,
    bucket: string,
    path: string,
    prompt: PromptPayload,
    context: string,
    createOnly: boolean,
  ): Promise<PromptMetadataItem> {
    const headers = {
      ...getBearerAuthHeaders(token),
      ...(createOnly ? { 'If-None-Match': '*' } : {}),
    };
    const { data, error, response } = (await this.dialClient.client.savePrompt(
      bucket,
      encodeDialResourcePath(path),
      { headers, body: prompt },
    )) as PromptWriteResult;

    if (response?.status === 412) {
      throw new ConflictException(`Prompt resource already exists: ${path}`);
    }
    if (error != null) {
      return handleDialSdkError(error, context, this.logger, response);
    }

    if (data?.nodeType === 'ITEM') {
      return data;
    }

    const metadata = await this.getPromptMetadataItem(token, bucket, path);
    if (metadata == null) {
      return handleDialSdkError(
        new Error('Saved prompt metadata is unavailable'),
        context,
        this.logger,
      );
    }
    return metadata;
  }

  private async readPromptByPath(
    token: string,
    bucket: string,
    path: string,
    knownMetadata?: PromptMetadataItem,
  ): Promise<PromptResponseDto | null> {
    try {
      const { data, error, response } = (await this.dialClient.client.getPrompt(
        bucket,
        encodeDialResourcePath(path),
        { headers: getBearerAuthHeaders(token) },
      )) as PromptReadResult;

      if (error != null || data == null) {
        if (response?.status === 404) return null;
        return handleDialSdkError(
          error,
          'prompts.readPrompt',
          this.logger,
          response,
        );
      }

      const metadata =
        knownMetadata ??
        (await this.getPromptMetadataItem(token, bucket, path));
      if (metadata == null) {
        return handleDialSdkError(
          new Error('Prompt metadata is unavailable'),
          'prompts.readPrompt',
          this.logger,
        );
      }

      return mapPromptToResponse(data, path, metadata);
    } catch (err) {
      return handleDialSdkError(err, 'prompts.readPrompt', this.logger);
    }
  }

  /* Returns ITEM-only metadata for all prompts under folderSubPath.
     404 is treated as an empty namespace (no prompts created yet). */
  private async listPromptMetadataItems(
    token: string,
    bucket: string,
    folderSubPath: string,
  ): Promise<PromptMetadataItem[]> {
    const items: PromptMetadataItem[] = [];
    const visitedTokens = new Set<string>();
    let pageToken: string | undefined;

    do {
      const { data, error, response } =
        (await this.dialClient.client.getPromptMetadata(
          bucket,
          folderSubPath ? encodeDialResourcePath(folderSubPath) : '',
          {
            headers: getBearerAuthHeaders(token),
            params: { query: { recursive: true, token: pageToken } },
          },
        )) as PromptMetadataListResult;

      if (response?.status === 404) {
        return [];
      }

      if (error != null || data == null) {
        return handleDialSdkError(
          error,
          'prompts.listMetadata',
          this.logger,
          response,
        );
      }

      items.push(
        ...(data.items ?? []).filter(
          (item): item is PromptMetadataItem => item.nodeType === 'ITEM',
        ),
      );
      pageToken = data.nextToken;
      if (pageToken != null) {
        if (visitedTokens.has(pageToken)) {
          return handleDialSdkError(
            new Error('DIAL Core returned a repeated metadata page token'),
            'prompts.listMetadata',
            this.logger,
          );
        }
        visitedTokens.add(pageToken);
      }
    } while (pageToken != null);

    return items;
  }

  /* ------------------------------------------------------------------ */
  /* Personal prompt CRUD                                               */
  /* ------------------------------------------------------------------ */

  async listPrompts(
    token: string,
    bucket: string,
  ): Promise<PromptListResponseDto> {
    try {
      const items = await this.listPromptMetadataItems(token, bucket, '');

      const promptItems = items
        .map((item) => ({
          item,
          path: metadataItemToPromptPath(item, bucket),
        }))
        .filter(
          (entry): entry is { item: PromptMetadataItem; path: string } =>
            entry.path != null && !isSentinelPath(entry.path),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToPromptPath(item, bucket))
        .filter((path): path is string => path != null && isSentinelPath(path))
        .map((path) => path.slice(0, -`/${FOLDER_SENTINEL}`.length))
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptItems.map(({ item, path }) =>
            this.readPromptByPath(token, bucket, path, item),
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
          if (parts.length < 3 || parts[0] !== 'prompts')
            return Promise.resolve(null);

          const ownerBucket = parts[1];
          const path = parts.slice(2).join('/');

          return this.readPromptByPath(token, ownerBucket, path);
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

    const metadata = await this.getPromptMetadataItem(token, bucket, path);
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

    const metadata = await this.savePromptResource(
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
    const targetId = isRename
      ? currentFolderId
        ? `${currentFolderId}/${newName}`
        : newName
      : path;
    const updatedPrompt: PromptPayload = {
      ...existing,
      id: targetId,
      name: newName,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      content: dto.content !== undefined ? dto.content : existing.content,
      folderId: folderIdFromId(targetId),
    };

    const metadata = await this.savePromptResource(
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
    const metadata = await this.getPromptMetadataItem(token, bucket, path);
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

  /* ------------------------------------------------------------------ */
  /* Organisation (public bucket) prompts                               */
  /* ------------------------------------------------------------------ */

  async listPublicPrompts(token: string): Promise<PublicPromptListResponseDto> {
    try {
      const items = await this.listPromptMetadataItems(
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
            entry.path != null && !isSentinelPath(entry.path),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToPromptPath(item, PUBLIC_BUCKET))
        .filter((path): path is string => path != null && isSentinelPath(path))
        .map((path) => path.slice(0, -`/${FOLDER_SENTINEL}`.length))
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptItems.map(({ item, path }) =>
            this.readPromptByPath(token, PUBLIC_BUCKET, path, item),
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

    const metadata = await this.getPromptMetadataItem(
      token,
      PUBLIC_BUCKET,
      path,
    );
    if (metadata == null) {
      throw new NotFoundException(`Public prompt metadata not found: ${path}`);
    }
    return mapPromptToResponse(data, path, metadata);
  }

  /* ------------------------------------------------------------------ */
  /* Folder operations                                                  */
  /* ------------------------------------------------------------------ */

  async createFolder(
    token: string,
    bucket: string,
    dto: CreatePromptFolderDto,
  ): Promise<PromptFolderResponseDto> {
    const folderPath = dto.parentId ? `${dto.parentId}/${dto.name}` : dto.name;
    const sentinelPath = `${folderPath}/${FOLDER_SENTINEL}`;
    await this.savePromptResource(
      token,
      bucket,
      sentinelPath,
      {
        id: sentinelPath,
        name: FOLDER_SENTINEL,
        content: '',
        folderId: folderPath,
      },
      'prompts.createFolder',
      true,
    );

    return { id: folderPath, name: dto.name };
  }

  async renameFolder(
    token: string,
    bucket: string,
    path: string,
    dto: RenamePromptFolderDto,
  ): Promise<PromptFolderResponseDto> {
    const folderSubPath = path;
    const allItems = await this.listPromptMetadataItems(
      token,
      bucket,
      folderSubPath,
    );

    if (allItems.length === 0) {
      throw new NotFoundException(`Folder not found: ${path}`);
    }

    const parentPath = folderIdFromId(path);
    const newPath = parentPath ? `${parentPath}/${dto.name}` : dto.name;
    const newFolderSubPath = newPath;

    const targetItems = await this.listPromptMetadataItems(
      token,
      bucket,
      newFolderSubPath,
    );
    if (targetItems.length > 0) {
      throw new ConflictException(`Folder already exists: ${newPath}`);
    }

    const oldPrefix = `${folderSubPath}/`;
    const newPrefix = `${newFolderSubPath}/`;

    await Promise.all(
      allItems.map(async (item) => {
        const oldSubPath = metadataItemToPromptPath(item, bucket);
        if (oldSubPath == null || !oldSubPath.startsWith(oldPrefix)) return;

        const relative = oldSubPath.slice(oldPrefix.length);
        const newSubPath = `${newPrefix}${relative}`;

        let prompt: PromptPayload = {
          id: newSubPath,
          name: FOLDER_SENTINEL,
          content: '',
          folderId: newPath,
        };

        if (!isSentinelPath(oldSubPath)) {
          const { data, error: readError } =
            (await this.dialClient.client.getPrompt(
              bucket,
              encodeDialResourcePath(oldSubPath),
              { headers: getBearerAuthHeaders(token) },
            )) as PromptReadResult;

          if (readError != null || data == null) {
            return handleDialSdkError(
              readError,
              'prompts.renameFolder.readSource',
              this.logger,
            );
          }

          prompt = {
            ...data,
            id: newSubPath,
            folderId: folderIdFromId(newSubPath),
          };
        }

        await this.savePromptResource(
          token,
          bucket,
          newSubPath,
          prompt,
          'prompts.renameFolder.writeTarget',
          true,
        );

        const { error: deleteError, response: deleteResponse } =
          (await this.dialClient.client.deletePrompt(
            bucket,
            encodeDialResourcePath(oldSubPath),
            { headers: getBearerAuthHeaders(token) },
          )) as PromptWriteResult;

        if (deleteError != null) {
          return handleDialSdkError(
            deleteError,
            'prompts.renameFolder.deleteSource',
            this.logger,
            deleteResponse,
          );
        }
      }),
    );

    return { id: newPath, name: dto.name };
  }

  async deleteFolder(
    token: string,
    bucket: string,
    path: string,
  ): Promise<void> {
    const folderSubPath = path;
    const items = await this.listPromptMetadataItems(
      token,
      bucket,
      folderSubPath,
    );

    if (items.length === 0) {
      throw new NotFoundException(`Folder not found: ${path}`);
    }

    await Promise.all(
      items.map(async (item) => {
        const subPath = metadataItemToPromptPath(item, bucket);
        if (subPath == null) return;

        const { error, response } = (await this.dialClient.client.deletePrompt(
          bucket,
          encodeDialResourcePath(subPath),
          { headers: getBearerAuthHeaders(token) },
        )) as PromptWriteResult;

        if (error != null) {
          return handleDialSdkError(
            error,
            'prompts.deleteFolder',
            this.logger,
            response,
          );
        }
      }),
    );
  }

  async movePrompt(
    token: string,
    bucket: string,
    path: string,
    dto: MovePromptDto,
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
        `movePrompt read failed — bucket: ${bucket}, path: ${path}, status: ${readResponse?.status}`,
      );
      return handleDialSdkError(
        readError,
        'prompts.movePrompt',
        this.logger,
        readResponse,
      );
    }

    const lastName = nameFromId(path);
    const targetId = dto.targetFolderId
      ? `${dto.targetFolderId}/${lastName}`
      : lastName;
    const movedPrompt: PromptPayload = {
      ...existing,
      id: targetId,
      folderId: folderIdFromId(targetId),
    };

    const metadata = await this.savePromptResource(
      token,
      bucket,
      targetId,
      movedPrompt,
      'prompts.movePrompt',
      true,
    );

    const { error: deleteError, response: deleteResponse } =
      (await this.dialClient.client.deletePrompt(
        bucket,
        encodeDialResourcePath(path),
        { headers: getBearerAuthHeaders(token) },
      )) as PromptWriteResult;

    if (deleteError != null) {
      return handleDialSdkError(
        deleteError,
        'prompts.movePrompt.deleteSource',
        this.logger,
        deleteResponse,
      );
    }

    return mapPromptToResponse(movedPrompt, targetId, metadata);
  }
}
