import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../app-config/app-config.service';
import { FeatureKey } from '../app-config/feature-flags/feature-key.enum';
import {
  getApiKeyAuthHeaders,
  getBearerAuthHeaders,
} from '../common/utils/auth-header';
import { EnvironmentVariables } from '../config/environment.config';
import { DialClientService } from '../dial/dial-client.service';
import { ConversationResponseDto } from '../openapi/openapi-response.dto';
import {
  CONVERSATION_PERSISTENCE,
  type ConversationPersistencePort,
} from './conversation-persistence.port';
import { ConversationMessageRole } from './dto/conversation-message.dto';
import { CONVERSATION_NAMING_SYSTEM_PROMPT } from './prompts/conversation-naming.prompt';
import { prepareEntityName } from './utils/conversation.utils';

const SERVER_APP_CONFIG_CONTEXT = { appId: 'chat-api' };

/*
 * Upper bound on how many recent non-status messages are fed into the prompt for
 * on-demand title generation. Keeps the prompt within the utility model context
 * window while still reflecting the current conversation topic. Tune if needed.
 */
const MAX_TITLE_GENERATION_MESSAGES = 50;

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class ConversationNamingService {
  private readonly logger = new Logger(ConversationNamingService.name);
  private readonly inFlightRenames = new Set<string>();

  constructor(
    private readonly dialClient: DialClientService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly appConfigService: AppConfigService,
    @Inject(CONVERSATION_PERSISTENCE)
    private readonly conversationPersistence: ConversationPersistencePort,
  ) {}

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

  async generateTitle(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<string> {
    const utilityModelId = this.configService.get('UTILITY_MODEL', {
      infer: true,
    });
    if (!utilityModelId) {
      this.logger.warn(
        `Cannot generate title for ${conversationPath}: UTILITY_MODEL is not configured`,
      );
      throw new ServiceUnavailableException(
        'LLM title generation is not available',
      );
    }

    /* Throws NotFoundException / typed DIAL errors when the conversation is unavailable. */
    const conversation = await this.conversationPersistence.getConversation(
      conversationPath,
      token,
      bucket,
    );

    const userContent = this.buildTitleGenerationPrompt(conversation);
    if (!userContent) {
      throw new BadRequestException(
        'Conversation has no content to generate a title from',
      );
    }

    const timeoutMs =
      this.configService.get('UTILITY_NAMING_TIMEOUT_MS', { infer: true }) ??
      10_000;

    this.logger.debug(
      `On-demand title generation for ${conversation.id}: model=${utilityModelId} timeoutMs=${timeoutMs} userContentLength=${userContent.length}`,
    );

    let llmTitle: string;
    try {
      llmTitle = await this.sendNamingCompletion(
        utilityModelId,
        getBearerAuthHeaders(token),
        userContent,
        timeoutMs,
      );
    } catch (error) {
      this.logger.warn(
        `On-demand LLM title generation failed for ${conversation.id}`,
        (error as Error | undefined)?.stack,
      );
      if (error instanceof Error && error.message.includes('timed out')) {
        throw new ServiceUnavailableException('LLM title generation timed out');
      }
      throw new BadGatewayException('LLM title generation failed');
    }

    const sanitisedTitle = prepareEntityName(llmTitle);
    if (!sanitisedTitle) {
      this.logger.warn(
        `LLM returned an empty title for conversation ${conversation.id}`,
      );
      throw new BadGatewayException('LLM returned an empty title');
    }

    this.logger.debug(
      `On-demand LLM title generated for ${conversation.id}: "${conversation.name}" -> "${sanitisedTitle}" (not persisted)`,
    );
    return sanitisedTitle;
  }

  private buildTitleGenerationPrompt(
    conversation: ConversationResponseDto,
  ): string {
    const recentMessages = conversation.messages
      .filter((message) => message.role !== ConversationMessageRole.Status)
      .slice(-MAX_TITLE_GENERATION_MESSAGES)
      .filter((message) => message.content?.trim());

    return recentMessages
      .map((message) => `${message.role}: ${message.content.trim()}`)
      .join('\n\n---\n\n');
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
      `LLM naming request to DIAL Core: model=${modelId} apiVersion=${this.dialClient.dialApiVersion} headers=${JSON.stringify(this.formatHeadersForLog(headers))}`,
    );

    try {
      const result = (await this.dialClient.client.sendChatCompletionRequest(
        modelId,
        {
          body: {
            messages: [
              { role: 'system', content: CONVERSATION_NAMING_SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
            stream: false,
          } as Parameters<
            typeof this.dialClient.client.sendChatCompletionRequest
          >[1]['body'],
          headers,
          params: { query: { 'api-version': this.dialClient.dialApiVersion } },
          signal: controller.signal,
        },
      )) as { data?: unknown; error?: unknown; response: Response };

      this.logger.debug(
        `LLM naming response from DIAL Core: model=${modelId} ${this.formatDialResponseForLog(result)}`,
      );

      if (!result.response.ok || result.error != null) {
        this.logger.debug(
          `LLM naming request failed for model=${modelId}: status=${result.response.status}`,
        );
        throw new Error(
          `DIAL Core rejected LLM naming request (status ${result.response.status})`,
        );
      }

      const data = result.data as CompletionResponse;
      const rawTitle = data.choices?.[0]?.message?.content ?? '';
      this.logger.debug(
        `LLM naming request succeeded for model=${modelId}: status=${result.response.status} rawTitleLength=${rawTitle.length}`,
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
