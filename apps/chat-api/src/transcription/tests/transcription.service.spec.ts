import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import { TranscribeAudioDto } from '../dto/transcribe-audio.dto';
import { TRANSCRIPTION_PROMPT } from '../prompts/transcription.prompt';
import { TranscriptionUnavailableException } from '../transcription-unavailable.exception';
import { TranscriptionService } from '../transcription.service';

const dto: TranscribeAudioDto = {
  audioUrl: 'files/bucket/recording.wav',
  mimeType: 'audio/wav',
};

const TOKEN = 'test-token';

const makeService = (
  sendChatCompletionRequest: ReturnType<typeof vi.fn>,
  prompt?: string,
) => {
  const dialClient = {
    client: { sendChatCompletionRequest },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'ASR_MODEL') return 'whisper-1';
      if (key === 'TRANSCRIPTION_PROMPT') return prompt;
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

  it.each([
    undefined,
    '',
    ' \t\n ',
    '  Transcribe only speech.\nPreserve العربية.\n',
  ])(
    'uses the configured prompt or default without changing the audio request (%j)',
    async (prompt) => {
      service = makeService(sendChatCompletionRequest, prompt);
      sendChatCompletionRequest.mockResolvedValue({
        data: { choices: [{ message: { content: 'hello' } }] },
        response: { ok: true },
      });
      await expect(service.transcribeAudio(dto, TOKEN)).resolves.toBe('hello');
      expect(sendChatCompletionRequest).toHaveBeenCalledWith(
        'whisper-1',
        expect.objectContaining({
          body: {
            messages: [
              {
                role: 'user',
                content: prompt?.trim() ? prompt : TRANSCRIPTION_PROMPT,
                custom_content: {
                  attachments: [
                    {
                      type: dto.mimeType,
                      title: 'recording',
                      url: dto.audioUrl,
                    },
                  ],
                },
              },
            ],
            stream: false,
          },
          headers: { Authorization: 'Bearer test-token' },
        }),
      );
    },
  );

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

  it.each([429, 503])(
    'preserves temporary unavailability and Retry-After for HTTP %i',
    async (status) => {
      sendChatCompletionRequest.mockResolvedValue({
        error: 'Service is not available',
        response: new Response(null, {
          status,
          headers: { 'Retry-After': '30' },
        }),
      });
      await expect(service.transcribeAudio(dto, TOKEN)).rejects.toMatchObject({
        status: 503,
        retryAfter: '30',
      });
      expect(sendChatCompletionRequest).toHaveBeenCalledTimes(1);
    },
  );

  it('supports unavailable responses without Retry-After', async () => {
    sendChatCompletionRequest.mockResolvedValue({
      error: 'Service is not available',
      response: new Response(null, { status: 503 }),
    });
    await expect(service.transcribeAudio(dto, TOKEN)).rejects.toBeInstanceOf(
      TranscriptionUnavailableException,
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
