import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

describe('background generation message field', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validate = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: ConversationMessageDto });
  const message = (backgroundGeneration?: unknown) => ({
    role: ConversationMessageRole.Assistant,
    content: '',
    timestamp: '2026-09-30T10:00:00Z',
    responseId: 'dial_gpt-4.1-nano_61994b96',
    ...(backgroundGeneration !== undefined && { backgroundGeneration }),
  });
  const pending = {
    generationId: '2d0b6c8e-5f7a-4c1b-9e3d-1a2b3c4d5e6f',
    status: BackgroundGenerationStatus.Pending,
    startedAt: 1790000000000,
  };

  it('keeps a pending background marker through validated serialization', async () => {
    const result = await validate(message(pending));
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(pending));
  });

  it.each(Object.values(BackgroundGenerationStatus))(
    'accepts the %s status',
    async (status) => {
      await expect(
        validate(message({ ...pending, status })),
      ).resolves.toBeDefined();
    },
  );

  it('rejects an unknown status', async () => {
    await expect(
      validate(message({ ...pending, status: 'running' })),
    ).rejects.toThrow();
  });

  it('rejects a non-integer startedAt', async () => {
    await expect(
      validate(message({ ...pending, startedAt: 'yesterday' })),
    ).rejects.toThrow();
  });

  it('leaves a message without the marker unchanged', async () => {
    const result = await validate(message());
    expect(JSON.parse(JSON.stringify(result))).toEqual(message());
  });
});
