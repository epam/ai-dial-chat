import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
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
        return handleDialError(
          result.error ?? { status: result.response.status },
        );
      }
      return result.data;
    } catch (error) {
      this.logger.error('DIAL Core sendCompletion failed', error);
      return handleDialError(error);
    }
  }
}
