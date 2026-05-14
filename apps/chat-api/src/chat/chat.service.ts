import { Injectable } from '@nestjs/common';
import { AppService } from '../app/app.service';
import { handleDialError } from '../common/utils/dial-error';
import { ChatCompletionDto } from './dto/chat-completion.dto';

@Injectable()
export class ChatService extends AppService {
  async sendCompletion(deployment: string, dto: ChatCompletionDto) {
    try {
      return await this.client.sendChatCompletionRequest(deployment, {
        body: dto,
      });
    } catch (error) {
      return handleDialError(error);
    }
  }
}
