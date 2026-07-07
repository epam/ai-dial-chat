import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialSdkError } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService extends AppService {
  protected override logger = new Logger(ChatService.name);

  async sendCompletion(
    dto: ChatCompletionDto,
    token: string,
  ): Promise<unknown> {
    const { deployment, ...body } = dto;
    try {
      const result = (await this.client.sendChatCompletionRequest(deployment, {
        body: body as Parameters<
          typeof this.client.sendChatCompletionRequest
        >[1]['body'],
        headers: getBearerAuthHeaders(token),
        params: { query: { 'api-version': this.dialApiVersion } },
      })) as { data?: unknown; error?: unknown; response: Response };

      if (!result.response.ok || result.error != null) {
        this.logger.error('DIAL Core rejected sendCompletion', result.error);
        return handleDialSdkError(
          result.error ?? { status: result.response.status },
          'chat.sendCompletion',
          this.logger,
        );
      }
      return result.data;
    } catch (error) {
      this.logger.error('DIAL Core sendCompletion failed', error);
      return handleDialSdkError(error, 'chat.sendCompletion', this.logger);
    }
  }
}
