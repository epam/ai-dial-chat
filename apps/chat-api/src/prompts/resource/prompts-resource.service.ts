import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { DialClientService } from '../../dial/dial-client.service';
import type { PromptResponseDto } from '../dto/prompt-response.dto';
import {
  mapPromptToResponse,
  type PromptMetadataItem,
  type PromptMetadataListResult,
  type PromptPayload,
  type PromptReadResult,
  type PromptWriteResult,
} from '../utils/prompt-mapper.util';

@Injectable()
export class PromptsResourceService {
  private readonly logger = new Logger(PromptsResourceService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async getPromptMetadataItem(
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

  async savePromptResource(
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

  async readPromptByPath(
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

      return mapPromptToResponse(data, path, metadata, bucket);
    } catch (err) {
      return handleDialSdkError(err, 'prompts.readPrompt', this.logger);
    }
  }

  /* Returns ITEM-only metadata for all prompts under folderSubPath.
     404 is treated as an empty namespace (no prompts created yet). */
  async listPromptMetadataItems(
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
            params: {
              query: {
                recursive: true,
                token: pageToken,
                permissions: true,
              },
            },
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
}
