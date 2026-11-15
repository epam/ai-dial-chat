import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

describe('foreground generation message field', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validate = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: ConversationMessageDto });
  const message = (foregroundGeneration?: unknown) => ({
    role: ConversationMessageRole.Assistant,
    content: '',
    timestamp: '2026-11-06T10:00:00Z',
    ...(foregroundGeneration !== undefined && { foregroundGeneration }),
  });
  const live = {
    generationId: '4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f',
    startedAt: 1793875200000,
    expiresAt: 1793877120000,
  };

  it('keeps a marker through validated serialization', async () => {
    const result = await validate(message(live));
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(live));
  });

  it('accepts a marker carrying a stored Stop', async () => {
    const stopped = { ...live, stopRequestedAt: 1793875260000 };
    const result = await validate(message(stopped));
    expect(JSON.parse(JSON.stringify(result))).toEqual(message(stopped));
  });

  it('rejects a generation id that is not a UUID v4', async () => {
    await expect(
      validate(message({ ...live, generationId: 'not-a-uuid' })),
    ).rejects.toThrow();
  });

  it.each(['startedAt', 'expiresAt', 'stopRequestedAt'])(
    'rejects a non-integer %s',
    async (field) => {
      await expect(
        validate(message({ ...live, [field]: 'tomorrow' })),
      ).rejects.toThrow();
    },
  );

  it('leaves a message without the marker unchanged', async () => {
    const result = await validate(message());
    expect(JSON.parse(JSON.stringify(result))).toEqual(message());
  });
});
