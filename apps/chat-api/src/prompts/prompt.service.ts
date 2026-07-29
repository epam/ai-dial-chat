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
import {
  FOLDER_SENTINEL,
  PROMPTS_SUBFOLDER,
} from './constants/prompt.constants';
import type { CreatePromptFolderDto } from './dto/create-prompt-folder.dto';
import type { CreatePromptDto } from './dto/create-prompt.dto';
import type { MovePromptDto } from './dto/move-prompt.dto';
import type { PromptFolderResponseDto } from './dto/prompt-folder-response.dto';
import type { PromptListResponseDto } from './dto/prompt-list-response.dto';
import type { PromptResponseDto } from './dto/prompt-response.dto';
import type { RenamePromptFolderDto } from './dto/rename-prompt-folder.dto';
import type { UpdatePromptDto } from './dto/update-prompt.dto';

const PUBLIC_BUCKET = 'public';

/* Full JSON shape stored in DIAL Core — superset of the SDK Prompt schema. */
interface StoredPromptData {
  id: string;
  name: string;
  description?: string;
  content: string;
  folderId: string;
  createdAt: number;
  updatedAt: number;
}

interface PromptMetadataItem {
  nodeType?: string;
  name?: string;
  url?: string;
  parentPath?: string;
}

interface PromptMetadataListResult {
  data?: { items?: PromptMetadataItem[]; nextToken?: string };
  error?: unknown;
  response?: globalThis.Response;
}

interface PromptReadResult {
  data?: StoredPromptData;
  error?: unknown;
  response?: globalThis.Response;
}

interface PromptWriteResult {
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

const toStorageSubPath = (userFacingId: string): string =>
  `${PROMPTS_SUBFOLDER}/${userFacingId}`;

const toUserFacingId = (storageSubPath: string): string => {
  const prefix = `${PROMPTS_SUBFOLDER}/`;
  return storageSubPath.startsWith(prefix)
    ? storageSubPath.slice(prefix.length)
    : storageSubPath;
};

const folderIdFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? '' : id.slice(0, lastSlash);
};

const nameFromId = (id: string): string => {
  const lastSlash = id.lastIndexOf('/');
  return lastSlash === -1 ? id : id.slice(lastSlash + 1);
};

const isSentinelStorageSubPath = (subPath: string): boolean =>
  subPath === `${PROMPTS_SUBFOLDER}/${FOLDER_SENTINEL}` ||
  subPath.endsWith(`/${FOLDER_SENTINEL}`);

/* Parses a DIAL Core resource URL back to the storage sub-path.
   URL format: 'prompts/{bucket}/{storageSubPath}' */
const urlToStorageSubPath = (url: string, bucket: string): string | null => {
  const decoded = safeDecodeURIComponent(url);
  const prefix = `prompts/${bucket}/`;
  return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : null;
};

const metadataItemToStorageSubPath = (
  item: PromptMetadataItem,
  bucket: string,
): string | null => {
  const raw =
    item.url ??
    (item.parentPath != null && item.name != null
      ? `${item.parentPath}/${item.name}`
      : null);
  return raw != null ? urlToStorageSubPath(raw, bucket) : null;
};

const mapStoredToResponse = (
  stored: StoredPromptData,
  id: string,
): PromptResponseDto => ({
  id,
  name: stored.name ?? nameFromId(id),
  description: stored.description,
  content: stored.content ?? '',
  folderId: stored.folderId ?? folderIdFromId(id),
  createdAt: stored.createdAt ?? 0,
  updatedAt: stored.updatedAt ?? 0,
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

  private async promptStoragePathExists(
    token: string,
    bucket: string,
    storageSubPath: string,
  ): Promise<boolean> {
    try {
      const { data, error, response } =
        (await this.dialClient.client.getPromptMetadata(
          bucket,
          encodeDialResourcePath(storageSubPath),
          { headers: getBearerAuthHeaders(token) },
        )) as PromptMetadataListResult;

      if (response?.status === 404) {
        return false;
      }
      if (error != null) {
        return handleDialSdkError(
          error,
          'prompts.checkPathExists',
          this.logger,
          response,
        );
      }
      return data != null;
    } catch (err) {
      return handleDialSdkError(err, 'prompts.checkPathExists', this.logger);
    }
  }

  private async readPromptByStoragePath(
    token: string,
    bucket: string,
    storageSubPath: string,
  ): Promise<PromptResponseDto | null> {
    try {
      const { data, error, response } = (await this.dialClient.client.getPrompt(
        bucket,
        encodeDialResourcePath(storageSubPath),
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

      return mapStoredToResponse(data, toUserFacingId(storageSubPath));
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
    let nextToken: string | undefined;

    do {
      const { data, error, response } =
        (await this.dialClient.client.getPromptMetadata(
          bucket,
          folderSubPath ? encodeDialResourcePath(folderSubPath) : '',
          {
            headers: getBearerAuthHeaders(token),
            params: { query: { recursive: true, nextToken } },
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
        ...(data.items ?? []).filter((item) => item.nodeType === 'ITEM'),
      );
      nextToken = data.nextToken;
      if (nextToken != null) {
        if (visitedTokens.has(nextToken)) {
          return handleDialSdkError(
            new Error('DIAL Core returned a repeated metadata page token'),
            'prompts.listMetadata',
            this.logger,
          );
        }
        visitedTokens.add(nextToken);
      }
    } while (nextToken != null);

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
      const items = await this.listPromptMetadataItems(
        token,
        bucket,
        PROMPTS_SUBFOLDER,
      );

      const promptStoragePaths = items
        .map((item) => metadataItemToStorageSubPath(item, bucket))
        .filter(
          (subPath): subPath is string =>
            subPath != null && !isSentinelStorageSubPath(subPath),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToStorageSubPath(item, bucket))
        .filter(
          (subPath): subPath is string =>
            subPath != null && isSentinelStorageSubPath(subPath),
        )
        .map((subPath) =>
          toUserFacingId(subPath).slice(0, -`/${FOLDER_SENTINEL}`.length),
        )
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptStoragePaths.map((subPath) =>
            this.readPromptByStoragePath(token, bucket, subPath),
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

          /* URL format: 'prompts/{ownerBucket}/{storageSubPath}' */
          const decoded = safeDecodeURIComponent(raw);
          const parts = decoded.split('/');
          if (parts.length < 3 || parts[0] !== 'prompts')
            return Promise.resolve(null);

          const ownerBucket = parts[1];
          const storageSubPath = parts.slice(2).join('/');

          return this.readPromptByStoragePath(
            token,
            ownerBucket,
            storageSubPath,
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
    const storageSubPath = toStorageSubPath(path);
    const { data, error, response } = (await this.dialClient.client.getPrompt(
      bucket,
      encodeDialResourcePath(storageSubPath),
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

    return mapStoredToResponse(data, path);
  }

  async createPrompt(
    token: string,
    bucket: string,
    dto: CreatePromptDto,
  ): Promise<PromptResponseDto> {
    const id = dto.folderId ? `${dto.folderId}/${dto.name}` : dto.name;
    const storageSubPath = toStorageSubPath(id);

    const alreadyExists = await this.promptStoragePathExists(
      token,
      bucket,
      storageSubPath,
    );
    if (alreadyExists) {
      throw new ConflictException(`Prompt already exists: ${id}`);
    }

    const now = Date.now();
    const storedData: StoredPromptData = {
      id,
      name: dto.name,
      description: dto.description,
      content: dto.content,
      folderId: dto.folderId ?? '',
      createdAt: now,
      updatedAt: now,
    };

    const { error, response } = (await this.dialClient.client.savePrompt(
      bucket,
      encodeDialResourcePath(storageSubPath),
      {
        headers: getBearerAuthHeaders(token),
        body: storedData as never,
      },
    )) as PromptWriteResult;

    if (error != null) {
      this.logger.error('DIAL Core rejected savePrompt (create)', error);
      return handleDialSdkError(
        error,
        'prompts.createPrompt',
        this.logger,
        response,
      );
    }

    return mapStoredToResponse(storedData, id);
  }

  async updatePrompt(
    token: string,
    bucket: string,
    path: string,
    dto: UpdatePromptDto,
  ): Promise<PromptResponseDto> {
    const storageSubPath = toStorageSubPath(path);

    const {
      data: existing,
      error: readError,
      response: readResponse,
    } = (await this.dialClient.client.getPrompt(
      bucket,
      encodeDialResourcePath(storageSubPath),
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
    const targetStorageSubPath = toStorageSubPath(targetId);

    if (isRename) {
      const targetExists = await this.promptStoragePathExists(
        token,
        bucket,
        targetStorageSubPath,
      );
      if (targetExists) {
        throw new ConflictException(
          `Prompt already exists at target path: ${targetId}`,
        );
      }
    }

    const updatedData: StoredPromptData = {
      ...existing,
      id: targetId,
      name: newName,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      content: dto.content !== undefined ? dto.content : existing.content,
      folderId: folderIdFromId(targetId),
      updatedAt: Date.now(),
    };

    const { error: saveError, response: saveResponse } =
      (await this.dialClient.client.savePrompt(
        bucket,
        encodeDialResourcePath(targetStorageSubPath),
        {
          headers: getBearerAuthHeaders(token),
          body: updatedData as never,
        },
      )) as PromptWriteResult;

    if (saveError != null) {
      this.logger.error('DIAL Core rejected savePrompt (update)', saveError);
      return handleDialSdkError(
        saveError,
        'prompts.updatePrompt',
        this.logger,
        saveResponse,
      );
    }

    if (isRename) {
      const { error: deleteError, response: deleteResponse } =
        (await this.dialClient.client.deletePrompt(
          bucket,
          encodeDialResourcePath(storageSubPath),
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

    return mapStoredToResponse(updatedData, targetId);
  }

  async deletePrompt(
    token: string,
    bucket: string,
    path: string,
  ): Promise<void> {
    const storageSubPath = toStorageSubPath(path);

    const exists = await this.promptStoragePathExists(
      token,
      bucket,
      storageSubPath,
    );
    if (!exists) {
      throw new NotFoundException(`Prompt not found: ${path}`);
    }

    const { error, response } = (await this.dialClient.client.deletePrompt(
      bucket,
      encodeDialResourcePath(storageSubPath),
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

  async listPublicPrompts(
    token: string,
  ): Promise<Omit<PromptListResponseDto, 'sharedWithMe'>> {
    try {
      const items = await this.listPromptMetadataItems(
        token,
        PUBLIC_BUCKET,
        PROMPTS_SUBFOLDER,
      );

      const promptStoragePaths = items
        .map((item) => metadataItemToStorageSubPath(item, PUBLIC_BUCKET))
        .filter(
          (subPath): subPath is string =>
            subPath != null && !isSentinelStorageSubPath(subPath),
        );
      const sentinelFolderIds = items
        .map((item) => metadataItemToStorageSubPath(item, PUBLIC_BUCKET))
        .filter(
          (subPath): subPath is string =>
            subPath != null && isSentinelStorageSubPath(subPath),
        )
        .map((subPath) =>
          toUserFacingId(subPath).slice(0, -`/${FOLDER_SENTINEL}`.length),
        )
        .filter((folderId) => folderId !== '');

      const prompts = (
        await Promise.all(
          promptStoragePaths.map((subPath) =>
            this.readPromptByStoragePath(token, PUBLIC_BUCKET, subPath),
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
    const storageSubPath = toStorageSubPath(path);
    const { data, error, response } = (await this.dialClient.client.getPrompt(
      PUBLIC_BUCKET,
      encodeDialResourcePath(storageSubPath),
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

    return mapStoredToResponse(data, path);
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
    const sentinelSubPath = `${PROMPTS_SUBFOLDER}/${folderPath}/${FOLDER_SENTINEL}`;

    const alreadyExists = await this.promptStoragePathExists(
      token,
      bucket,
      sentinelSubPath,
    );
    if (alreadyExists) {
      throw new ConflictException(`Folder already exists: ${folderPath}`);
    }

    const { error, response } = (await this.dialClient.client.savePrompt(
      bucket,
      encodeDialResourcePath(sentinelSubPath),
      { headers: getBearerAuthHeaders(token), body: {} as never },
    )) as PromptWriteResult;

    if (error != null) {
      this.logger.error('DIAL Core rejected savePrompt (createFolder)', error);
      return handleDialSdkError(
        error,
        'prompts.createFolder',
        this.logger,
        response,
      );
    }

    return { id: folderPath, name: dto.name };
  }

  async renameFolder(
    token: string,
    bucket: string,
    path: string,
    dto: RenamePromptFolderDto,
  ): Promise<PromptFolderResponseDto> {
    const folderSubPath = `${PROMPTS_SUBFOLDER}/${path}`;
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
    const newFolderSubPath = `${PROMPTS_SUBFOLDER}/${newPath}`;

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
        const oldSubPath = metadataItemToStorageSubPath(item, bucket);
        if (oldSubPath == null || !oldSubPath.startsWith(oldPrefix)) return;

        const relative = oldSubPath.slice(oldPrefix.length);
        const newSubPath = `${newPrefix}${relative}`;

        let writeBody: Record<string, unknown> = {};

        if (!isSentinelStorageSubPath(oldSubPath)) {
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

          const newId = toUserFacingId(newSubPath);
          writeBody = {
            ...data,
            id: newId,
            folderId: folderIdFromId(newId),
            updatedAt: Date.now(),
          };
        }

        const { error: saveError, response: saveResponse } =
          (await this.dialClient.client.savePrompt(
            bucket,
            encodeDialResourcePath(newSubPath),
            { headers: getBearerAuthHeaders(token), body: writeBody as never },
          )) as PromptWriteResult;

        if (saveError != null) {
          return handleDialSdkError(
            saveError,
            'prompts.renameFolder.writeTarget',
            this.logger,
            saveResponse,
          );
        }

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
    const folderSubPath = `${PROMPTS_SUBFOLDER}/${path}`;
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
        const subPath = metadataItemToStorageSubPath(item, bucket);
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
    const storageSubPath = toStorageSubPath(path);

    const {
      data: existing,
      error: readError,
      response: readResponse,
    } = (await this.dialClient.client.getPrompt(
      bucket,
      encodeDialResourcePath(storageSubPath),
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
    const targetStorageSubPath = toStorageSubPath(targetId);

    const targetExists = await this.promptStoragePathExists(
      token,
      bucket,
      targetStorageSubPath,
    );
    if (targetExists) {
      throw new ConflictException(
        `Prompt already exists at target path: ${targetId}`,
      );
    }

    const updatedData: StoredPromptData = {
      ...existing,
      id: targetId,
      folderId: folderIdFromId(targetId),
      updatedAt: Date.now(),
    };

    const { error: saveError, response: saveResponse } =
      (await this.dialClient.client.savePrompt(
        bucket,
        encodeDialResourcePath(targetStorageSubPath),
        { headers: getBearerAuthHeaders(token), body: updatedData as never },
      )) as PromptWriteResult;

    if (saveError != null) {
      this.logger.error(
        'DIAL Core rejected savePrompt (movePrompt)',
        saveError,
      );
      return handleDialSdkError(
        saveError,
        'prompts.movePrompt',
        this.logger,
        saveResponse,
      );
    }

    const { error: deleteError, response: deleteResponse } =
      (await this.dialClient.client.deletePrompt(
        bucket,
        encodeDialResourcePath(storageSubPath),
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

    return mapStoredToResponse(updatedData, targetId);
  }
}
