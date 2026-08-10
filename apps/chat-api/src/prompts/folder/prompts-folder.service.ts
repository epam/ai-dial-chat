import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import { FOLDER_SENTINEL } from '../constants/prompt.constants';
import type { CreatePromptFolderDto } from '../dto/create-prompt-folder.dto';
import type { MovePromptDto } from '../dto/move-prompt.dto';
import type { PromptFolderResponseDto } from '../dto/prompt-folder-response.dto';
import type { PromptResponseDto } from '../dto/prompt-response.dto';
import type { RenamePromptFolderDto } from '../dto/rename-prompt-folder.dto';
import { PromptsResourceService } from '../resource/prompts-resource.service';
import {
  folderIdFromId,
  isSentinelPath,
  mapPromptToResponse,
  metadataItemToPromptPath,
  nameFromId,
  type PromptPayload,
  type PromptReadResult,
  type PromptWriteResult,
} from '../utils/prompt-mapper.util';

@Injectable()
export class PromptsFolderService {
  private readonly logger = new Logger(PromptsFolderService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly resourceService: PromptsResourceService,
  ) {}

  async createFolder(
    token: string,
    bucket: string,
    dto: CreatePromptFolderDto,
  ): Promise<PromptFolderResponseDto> {
    const folderPath = dto.parentId ? `${dto.parentId}/${dto.name}` : dto.name;
    const sentinelPath = `${folderPath}/${FOLDER_SENTINEL}`;
    await this.resourceService.savePromptResource(
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
    const allItems = await this.resourceService.listPromptMetadataItems(
      token,
      bucket,
      path,
    );

    if (allItems.length === 0) {
      throw new NotFoundException(`Folder not found: ${path}`);
    }

    const parentPath = folderIdFromId(path);
    const newPath = parentPath ? `${parentPath}/${dto.name}` : dto.name;

    const targetItems = await this.resourceService.listPromptMetadataItems(
      token,
      bucket,
      newPath,
    );
    if (targetItems.length > 0) {
      throw new ConflictException(`Folder already exists: ${newPath}`);
    }

    const oldPrefix = `${path}/`;
    const newPrefix = `${newPath}/`;

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

        await this.resourceService.savePromptResource(
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
    const items = await this.resourceService.listPromptMetadataItems(
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

    const metadata = await this.resourceService.savePromptResource(
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
