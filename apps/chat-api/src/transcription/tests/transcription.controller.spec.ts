import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TranscriptionUnavailableException } from '../transcription-unavailable.exception';
import { TranscriptionController } from '../transcription.controller';
import { TranscriptionService } from '../transcription.service';

describe('transcription unavailable HTTP response', () => {
  let app: INestApplication;
  const transcribeAudio = vi.fn();

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TranscriptionController],
      providers: [
        { provide: TranscriptionService, useValue: { transcribeAudio } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { at: 'test-token' } as Request['user'];
      next();
    });
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => app.close());

  it('retains Retry-After when Nest serializes the exception', async () => {
    transcribeAudio.mockRejectedValue(
      new TranscriptionUnavailableException('30'),
    );
    const response = await fetch(`${await app.getUrl()}/transcription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: 'files/bucket/voice.webm',
        mimeType: 'audio/webm',
      }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('30');
    expect(await response.json()).toMatchObject({ statusCode: 503 });
  });
});
