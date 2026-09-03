import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import { TranscribeAudioDto } from '../dto/transcribe-audio.dto';
import { TranscriptionService } from '../transcription.service';

const dto: TranscribeAudioDto = {
  audioUrl: 'files/bucket/recording.wav',
  mimeType: 'audio/wav',
};

const TOKEN = 'test-token';

const makeService = (sendChatCompletionRequest: ReturnType<typeof vi.fn>) => {
  const dialClient = {
    client: { sendChatCompletionRequest },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'ASR_MODEL') return 'whisper-1';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  return new TranscriptionService(dialClient, configService);
};

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let sendChatCompletionRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendChatCompletionRequest = vi.fn();
    service = makeService(sendChatCompletionRequest);
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

  it('forwards the job title in the X-JOB-TITLE header when provided', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      data: { choices: [{ message: { content: 'hello' } }] },
      error: undefined,
      response: { ok: true },
    });

    await service.transcribeAudio(dto, TOKEN, 'Lead Software Engineer');

    const [, options] = sendChatCompletionRequest.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(options.headers['X-JOB-TITLE']).toBe('Lead Software Engineer');
  });

  it('omits the X-JOB-TITLE header when no job title is provided', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      data: { choices: [{ message: { content: 'hello' } }] },
      error: undefined,
      response: { ok: true },
    });

    await service.transcribeAudio(dto, TOKEN);

    const [, options] = sendChatCompletionRequest.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(options.headers).not.toHaveProperty('X-JOB-TITLE');
  });
});
