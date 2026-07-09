import { Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async sendCompletion(
    dto: ChatCompletionDto,
    token: string,
  ): Promise<unknown> {
    const { deployment, ...body } = dto;
    try {
      const result = (await this.dialClient.client.sendChatCompletionRequest(
        deployment,
        {
          body: body as Parameters<
            typeof this.dialClient.client.sendChatCompletionRequest
          >[1]['body'],
          headers: getBearerAuthHeaders(token),
          params: {
            query: { 'api-version': this.dialClient.dialApiVersion },
          },
        },
      )) as { data?: unknown; error?: unknown; response: Response };

      if (!result.response.ok || result.error != null) {
        this.logger.error('DIAL Core rejected sendCompletion', result.error);
        return handleDialSdkError(
          result.error,
          'chat.sendCompletion',
          this.logger,
          result.response,
        );
      }
      return result.data;
    } catch (error) {
      this.logger.error('DIAL Core sendCompletion failed', error);
      return handleDialSdkError(error, 'chat.sendCompletion', this.logger);
    }
  }
}
