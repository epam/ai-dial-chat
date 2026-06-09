import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AppService } from '../app/app.service';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { handleDialError } from '../common/utils/dial-error';
import { TranscribeAudioDto } from './dto/transcribe-audio.dto';

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class TranscriptionService extends AppService {
  protected override logger = new Logger(TranscriptionService.name);

  async transcribeAudio(dto: TranscribeAudioDto, token: string): Promise<string> {
    const asrModelId = this.configService.get('ASR_MODEL', { infer: true });
    if (!asrModelId) {
      throw new InternalServerErrorException('ASR_MODEL is not configured');
    }

    const { audioUrl, mimeType } = dto;

    try {
      const result = (await this.client.sendChatCompletionRequest(asrModelId, {
        body: {
          messages: [
            {
              role: 'user',
              content: 'Transcribe the audio, return the content only, no extra',
              custom_content: {
                attachments: [{ type: mimeType, title: 'recording', url: audioUrl }],
              },
            },
          ],
          stream: false,
        } as Parameters<typeof this.client.sendChatCompletionRequest>[1]['body'],
        headers: getBearerAuthHeaders(token),
        params: { query: { 'api-version': this.dialApiVersion } },
      })) as { data?: unknown; error?: unknown; response: Response };

      if (!result.response.ok || result.error != null) {
        this.logger.error('DIAL Core rejected transcription request', result.error);
        return handleDialError(result.error ?? { status: result.response.status });
      }

      const data = result.data as CompletionResponse;
      return data.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      if (
        error instanceof InternalServerErrorException ||
        (error as { status?: number })?.status != null
      ) {
        throw error;
      }
      this.logger.error('DIAL Core transcription failed', error);
      return handleDialError(error);
    }
  }
}
