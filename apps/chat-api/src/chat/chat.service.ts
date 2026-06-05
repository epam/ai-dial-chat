import { Injectable, Logger } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService extends AppService {
  protected logger = new Logger(ChatService.name);

  async sendCompletion(deployment: string, dto: ChatCompletionDto) {
    try {
      return await this.client.sendChatCompletionRequest(deployment, {
        body: dto,
        params: { query: { 'api-version': this.dialApiVersion } },
      });
    } catch (error) {
      this.logger.error('DIAL Core rejected sendCompletion', error);
      return handleDialError(error);
    }
  }
}
