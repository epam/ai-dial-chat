import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { TranscribeAudioDto } from '../dto/transcribe-audio.dto';

const validateDto = async (body: Record<string, unknown>) =>
  validate(plainToInstance(TranscribeAudioDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const VALID_BODY = {
  audioUrl: 'files/bucket/recording.webm',
  mimeType: 'audio/webm;codecs=opus',
};

describe('TranscribeAudioDto', () => {
  it('accepts a non-empty audio URL and MIME type', async () => {
    expect(await validateDto(VALID_BODY)).toHaveLength(0);
  });

  it.each(['audioUrl', 'mimeType'])('rejects an empty %s', async (field) => {
    const errors = await validateDto({ ...VALID_BODY, [field]: '' });

    expect(errors.map((error) => error.property)).toEqual([field]);
  });
});
