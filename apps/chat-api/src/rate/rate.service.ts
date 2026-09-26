import { Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import {
  buildConversationIdHeaders,
  buildJobTitleHeaders,
} from '../common/utils/header-value';
import { DialClientService } from '../dial/dial-client.service';
import { MessageRating, type RateMessageDto } from './dto/rate-message.dto';

@Injectable()
export class RateService {
  private readonly logger = new Logger(RateService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async rateMessage(
    dto: RateMessageDto,
    accessToken: string,
    jobTitle?: string,
  ): Promise<void> {
    /*
     * `dto.modelId` is the deployment id the conversation was created
     * against — `conversation.model.id` — passed through unencoded, the same
     * way the DIAL SDK builds every other `/v1/deployments/{deployment_name}`-
     * style URL (see `sendChatCompletionRequestUrl` in
     * `@epam/ai-dial-typescript-sdk`). A plain model id (e.g. "gpt-4o") has no
     * characters that need encoding, but a custom app's deployment id is a
     * multi-segment DIAL Core resource path (e.g.
     * "applications/<bucket>/My%20App__1.0", already percent-encoded per
     * segment by the frontend) whose literal "/" separators are meaningful
     * path segments. Wrapping the whole string in `encodeURIComponent` would
     * turn those into `%2F` and 404 against DIAL Core.
     */
    const url = `${this.dialClient.baseUrl}/v1/${dto.modelId}/rate`;

    this.logger.debug(
      `Rating message: responseId=${dto.responseId}, rate=${dto.rate}, modelId=${dto.modelId}`,
    );

    try {
      // DIAL Core's RateRequest only accepts { responseId, rate: boolean } — no
      // modelId/conversationId/comment. modelId already selects the URL path segment
      // above and conversationId already drives the X-CONVERSATION-ID header below.
      const body = {
        responseId: dto.responseId,
        rate: dto.rate === MessageRating.Like,
      };

      const response = await this.dialClient.fetchCore(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getBearerAuthHeaders(accessToken),
          ...buildConversationIdHeaders(dto.conversationId),
          ...buildJobTitleHeaders(jobTitle),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw Object.assign(new Error('DIAL Core rate error'), {
          status: response.status,
        });
      }
    } catch (error) {
      handleDialSdkError(error, 'rate.rateMessage', this.logger);
    }
  }
}
