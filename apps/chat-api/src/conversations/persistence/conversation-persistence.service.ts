import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ConversationNamingService } from '../conversation-naming.service';
import type { ConversationPersistencePort } from '../conversation-persistence.port';
import {
  getConversationTitleFromName,
  qualifySessionConversationPath,
  resolveConversationLocation,
  resolveListDisplayTitle,
} from '../utils/conversation.utils';

@Injectable()
export class ConversationPersistenceService implements ConversationPersistencePort {
  private readonly logger = new Logger(ConversationPersistenceService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(forwardRef(() => ConversationNamingService))
    private readonly conversationNamingService: ConversationNamingService,
  ) {}

  async getConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    try {
      const { conversation, subPath } = await this.getStoredConversation(
        conversationPath,
        token,
        sessionBucket,
      );
      const filename = subPath.split('/').pop() ?? subPath;
      const pathTitle = getConversationTitleFromName(
        safeDecodeURIComponent(filename),
      );
      const resolvedName = resolveListDisplayTitle(pathTitle, conversation);
      return resolvedName === conversation.name
        ? conversation
        : { ...conversation, name: resolvedName };
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation', error);
      return handleDialSdkError(
        error,
        'conversations.getConversation',
        this.logger,
      );
    }
  }

  async getStoredConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<{ conversation: ConversationResponseDto; subPath: string }> {
    const { bucket, subPath } = resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );

    const { data, error, response } =
      (await this.dialClient.client.getConversation(
        bucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as {
        data?: unknown;
        error?: unknown;
        response: globalThis.Response;
      };
    if (error != null || !data) {
      this.logger.debug(
        `getStoredConversation rejected — bucket: ${bucket}, subPath: ${subPath}, status: ${response.status}, error: ${JSON.stringify(error)}`,
      );
      handleDialSdkError(
        error,
        'conversations.getStoredConversation',
        this.logger,
        response,
      );
    }

    return {
      conversation: data as ConversationResponseDto,
      subPath,
    };
  }

  async saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    const bodyToSave = await this.preserveLlmDisplayName(
      conversationPath,
      token,
      bucket,
      conversation,
    );

    try {
      const { data, error, response } =
        await this.dialClient.client.saveConversation(
          bucket,
          encodeDialResourcePath(conversationPath),
          {
            headers: getBearerAuthHeaders(token),
            body: bodyToSave as never,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialSdkError(
          error,
          'conversations.saveConversation',
          this.logger,
          response,
        );
      }
      const saved = { ...data, ...bodyToSave } as ConversationResponseDto;
      if (saved.llmNamingDone !== true) {
        this.conversationNamingService.maybeRenameAfterFirstReply(
          conversationPath,
          token,
          bucket,
          saved,
        );
      }
      return saved;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialSdkError(
        error,
        'conversations.saveConversation',
        this.logger,
      );
    }
  }

  /**
   * Client saves often carry a stale message-derived `name`. Once LLM naming has
   * persisted a display title, later saves must not overwrite it.
   */
  private async preserveLlmDisplayName(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    if (conversation.llmNamingDone === true) {
      return conversation;
    }

    try {
      const { conversation: existing } = await this.getStoredConversation(
        qualifySessionConversationPath(conversationPath, bucket),
        token,
        bucket,
      );
      if (existing.llmNamingDone === true && existing.name?.trim()) {
        return {
          ...conversation,
          name: existing.name,
          llmNamingDone: true,
        };
      }
    } catch {
      // New conversations or transient read failures keep the incoming body.
    }

    return conversation;
  }
}
