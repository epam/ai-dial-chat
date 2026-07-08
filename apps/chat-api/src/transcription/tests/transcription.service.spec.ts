import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../config/environment.config';
import { TranscribeAudioDto } from '../dto/transcribe-audio.dto';
import { TranscriptionService } from '../transcription.service';

const dto: TranscribeAudioDto = {
  audioUrl: 'files/bucket/recording.wav',
  mimeType: 'audio/wav',
};

const TOKEN = 'test-token';

const makeService = () => {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_API_VERSION') return '2024-10-21';
      if (key === 'ASR_MODEL') return 'whisper-1';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;
  return new TranscriptionService(configService);
};

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let sendChatCompletionRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = makeService();
    sendChatCompletionRequest = vi.fn();
    (
      service as unknown as { client: { sendChatCompletionRequest: unknown } }
    ).client = {
      sendChatCompletionRequest,
    };
  });

  it('throws NotFoundException from response.status when the error body carries no status', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      data: undefined,
      error: { message: 'Resource not found' },
      response: { ok: false, status: 404 },
    });

    await expect(service.transcribeAudio(dto, TOKEN)).rejects.toThrow(
      NotFoundException,
    );
  });
});
