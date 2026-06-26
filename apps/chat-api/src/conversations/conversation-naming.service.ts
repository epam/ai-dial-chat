import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from '../app/app.service';
import { AppConfigService } from '../app-config/app-config.service';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import { getApiKeyAuthHeaders } from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { ConversationResponseDto } from '../openapi/openapi-response.dto';
import type { ConversationPersistencePort } from './conversation-persistence.port';
import { CONVERSATION_PERSISTENCE } from './conversation-persistence.port';
import { ConversationMessageRole } from './dto/conversation-message.dto';
import { CONVERSATION_NAMING_SYSTEM_PROMPT } from './prompts/conversation-naming.prompt';
import { prepareEntityName } from './utils/conversation.utils';

const SERVER_APP_CONFIG_CONTEXT = { appId: 'chat-api' };

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class ConversationNamingService extends AppService {
  protected override logger = new Logger(ConversationNamingService.name);
  private readonly inFlightRenames = new Set<string>();

  constructor(
    configService: ConfigService<EnvironmentVariables>,
    private readonly appConfigService: AppConfigService,
    @Inject(CONVERSATION_PERSISTENCE)
    private readonly conversationPersistence: ConversationPersistencePort,
  ) {
    super(configService);
  }

  maybeRenameAfterFirstReply(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): void {
    this.logger.debug(
      `LLM naming hook scheduled for conversation=${conversation.id} path=${conversationPath} name="${conversation.name}" messageCount=${conversation.messages.length} llmNamingDone=${String(conversation.llmNamingDone)}`,
    );
    void this.runMaybeRenameAfterFirstReply(
      conversationPath,
      token,
      bucket,
      conversation,
    ).catch((error) => {
      this.logger.warn(
        `Unexpected error in LLM conversation naming for ${conversation.id}`,
        (error as Error | undefined)?.stack,
      );
    });
  }

  private async runMaybeRenameAfterFirstReply(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<void> {
    const conversationId = conversation.id;

    if (conversation.llmNamingDone === true) {
      this.logger.debug(
        `Skipping LLM naming for ${conversationId}: llmNamingDone=true`,
      );
      return;
    }

    if (this.inFlightRenames.has(conversationId)) {
      this.logger.debug(
        `Skipping concurrent LLM rename for conversation ${conversationId}`,
      );
      return;
    }

    const enabled = await this.appConfigService.isEnabled(
      FeatureKey.LlmConversationNaming,
      SERVER_APP_CONFIG_CONTEXT,
    );
    if (!enabled) {
      const utilityModel = this.configService.get('UTILITY_MODEL', {
        infer: true,
      });
      const dialApiKey = this.configService.get('DIAL_API_KEY', {
        infer: true,
      });
      const explicitEnabled = this.configService.get(
        'LLM_CONVERSATION_NAMING_ENABLED',
        { infer: true },
      );
      this.logger.debug(
        `Skipping LLM naming for ${conversationId}: feature disabled (UTILITY_MODEL=${utilityModel ? 'set' : 'unset'}, DIAL_API_KEY=${dialApiKey ? 'set' : 'unset'}, LLM_CONVERSATION_NAMING_ENABLED=${explicitEnabled === true})`,
      );
      return;
    }

    const triggerState = this.getNamingTriggerState(conversation);
    if (!triggerState.shouldTrigger) {
      this.logger.debug(
        `Skipping LLM naming for ${conversationId}: ${triggerState.reason}`,
      );
      return;
    }

    this.logger.debug(
      `Starting LLM naming for ${conversationId} currentName="${conversation.name}"`,
    );
    this.inFlightRenames.add(conversationId);
    try {
      await this.renameWithLlm(conversationPath, token, bucket, conversation);
    } finally {
      this.inFlightRenames.delete(conversationId);
    }
  }

  private getNamingTriggerState(conversation: ConversationResponseDto): {
    shouldTrigger: boolean;
    reason: string;
  } {
    const nonStatusMessages = conversation.messages.filter(
      (message) => message.role !== ConversationMessageRole.Status,
    );

    if (nonStatusMessages.length !== 2) {
      return {
        shouldTrigger: false,
        reason: `expected 2 non-status messages, got ${nonStatusMessages.length}`,
      };
    }

    const [userMessage, assistantMessage] = nonStatusMessages;
    if (userMessage.role !== ConversationMessageRole.User) {
      return {
        shouldTrigger: false,
        reason: `first non-status message role is ${userMessage.role}, expected user`,
      };
    }
    if (assistantMessage.role !== ConversationMessageRole.Assistant) {
      return {
        shouldTrigger: false,
        reason: `second non-status message role is ${assistantMessage.role}, expected assistant`,
      };
    }
    if (!userMessage.content?.trim() || !assistantMessage.content?.trim()) {
      return {
        shouldTrigger: false,
        reason: 'user or assistant message has empty content',
      };
    }

    const lastMessage = conversation.messages.at(-1);
    if (lastMessage !== assistantMessage) {
      return {
        shouldTrigger: false,
        reason: `last message role is ${lastMessage?.role ?? 'none'}, expected assistant`,
      };
    }

    return { shouldTrigger: true, reason: 'trigger conditions met' };
  }

  private async renameWithLlm(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<void> {
    const utilityModelId = this.configService.get('UTILITY_MODEL', {
      infer: true,
    });
    if (!utilityModelId) {
      this.logger.warn('UTILITY_MODEL is not configured; skipping LLM rename');
      return;
    }

    const dialApiKey = this.configService.get('DIAL_API_KEY', { infer: true });
    if (!dialApiKey) {
      this.logger.warn('DIAL_API_KEY is not configured; skipping LLM rename');
      return;
    }

    const nonStatusMessages = conversation.messages.filter(
      (message) => message.role !== ConversationMessageRole.Status,
    );
    const userMessage = nonStatusMessages[0];
    const assistantMessage = nonStatusMessages[1];
    const userContent = `${userMessage.content}\n\n---\n\n${assistantMessage.content}`;

    const timeoutMs =
      this.configService.get('UTILITY_NAMING_TIMEOUT_MS', { infer: true }) ??
      10_000;

    this.logger.debug(
      `Calling utility model for ${conversation.id}: model=${utilityModelId} timeoutMs=${timeoutMs} userContentLength=${userContent.length} auth=Api-Key`,
    );

    let llmTitle: string;
    try {
      llmTitle = await this.requestLlmTitle(
        utilityModelId,
        dialApiKey,
        userContent,
        timeoutMs,
      );
    } catch (error) {
      this.logger.warn(
        `LLM conversation naming failed for ${conversation.id}`,
        (error as Error | undefined)?.stack,
      );
      return;
    }

    const sanitisedTitle = prepareEntityName(llmTitle);
    this.logger.debug(
      `LLM title response for ${conversation.id}: rawLength=${llmTitle.length} sanitised="${sanitisedTitle}"`,
    );
    if (!sanitisedTitle) {
      this.logger.warn(
        `LLM returned an empty title for conversation ${conversation.id}`,
      );
      return;
    }

    try {
      const refreshed = await this.conversationPersistence.getConversation(
        conversationPath,
        token,
        bucket,
      );
      if (refreshed.llmNamingDone === true) {
        this.logger.debug(
          `Skipping LLM display name update for ${conversation.id}: llmNamingDone=true after refresh`,
        );
        return;
      }

      await this.conversationPersistence.saveConversation(
        conversationPath,
        token,
        bucket,
        { ...refreshed, name: sanitisedTitle, llmNamingDone: true },
      );
      this.logger.debug(
        `LLM naming completed for ${conversation.id}: "${conversation.name}" -> "${sanitisedTitle}"`,
      );
    } catch (error) {
      this.logger.warn(
        `LLM display name update failed for conversation ${conversation.id}`,
        (error as Error | undefined)?.stack,
      );
    }
  }

  private async requestLlmTitle(
    modelId: string,
    dialApiKey: string,
    userContent: string,
    timeoutMs: number,
  ): Promise<string> {
    return this.sendNamingCompletion(
      modelId,
      getApiKeyAuthHeaders(dialApiKey),
      userContent,
      timeoutMs,
    );
  }

  private async sendNamingCompletion(
    modelId: string,
    headers: Record<string, string>,
    userContent: string,
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    this.logger.debug(
      `LLM naming request to DIAL Core: model=${modelId} apiVersion=${this.dialApiVersion} headers=${JSON.stringify(this.formatHeadersForLog(headers))}`,
    );

    try {
      const result = (await this.client.sendChatCompletionRequest(modelId, {
        body: {
          messages: [
            { role: 'system', content: CONVERSATION_NAMING_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          stream: false,
        } as Parameters<
          typeof this.client.sendChatCompletionRequest
        >[1]['body'],
        headers,
        params: { query: { 'api-version': this.dialApiVersion } },
        signal: controller.signal,
      })) as { data?: unknown; error?: unknown; response: Response };

      this.logger.debug(
        `LLM naming response from DIAL Core: model=${modelId} ${this.formatDialResponseForLog(result)}`,
      );

      if (!result.response.ok || result.error != null) {
        this.logger.debug(
          `LLM naming request failed for model=${modelId} auth=Api-Key: status=${result.response.status}`,
        );
        throw new Error(
          `DIAL Core rejected LLM naming request (status ${result.response.status})`,
        );
      }

      const data = result.data as CompletionResponse;
      const rawTitle = data.choices?.[0]?.message?.content ?? '';
      this.logger.debug(
        `LLM naming request succeeded for model=${modelId} auth=Api-Key: status=${result.response.status} rawTitleLength=${rawTitle.length}`,
      );
      return rawTitle;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`LLM naming timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private formatHeadersForLog(
    headers: Record<string, string>,
  ): Record<string, string> {
    return Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        this.isSensitiveHeader(key) ? this.maskSecret(value) : value,
      ]),
    );
  }

  private formatDialResponseForLog(result: {
    data?: unknown;
    error?: unknown;
    response: Response;
  }): string {
    const responseHeaders =
      result.response.headers != null
        ? Object.fromEntries(result.response.headers.entries())
        : {};
    const parts = [
      `status=${result.response.status ?? 'unknown'}`,
      `statusText=${result.response.statusText ?? ''}`,
      `responseHeaders=${JSON.stringify(this.formatHeadersForLog(responseHeaders))}`,
    ];

    if (result.error != null) {
      parts.push(`errorBody=${this.truncateForLog(result.error)}`);
    }
    if (result.data != null) {
      parts.push(`dataBody=${this.truncateForLog(result.data)}`);
    }

    return parts.join(' ');
  }

  private isSensitiveHeader(headerName: string): boolean {
    const normalized = headerName.toLowerCase();
    return normalized === 'api-key' || normalized === 'authorization';
  }

  private maskSecret(value: string): string {
    if (!value) {
      return '[empty]';
    }
    if (value.length <= 8) {
      return `[redacted:${value.length} chars]`;
    }
    return `${value.slice(0, 4)}...${value.slice(-4)} (${value.length} chars)`;
  }

  private truncateForLog(value: unknown, maxLength = 2000): string {
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length <= maxLength) {
        return serialized;
      }
      return `${serialized.slice(0, maxLength)}...[truncated]`;
    } catch {
      return String(value);
    }
  }
}
