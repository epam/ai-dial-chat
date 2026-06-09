import { describe, expect, it } from 'vitest';
import {
  MIME_TYPE_AUDIO_PREFIX,
  MIME_TYPE_WILDCARD,
} from '../../constants/mime-types';
import { isAudioTranscriptionSupported } from '../is-audio-transcription-supported';

describe('isAudioTranscriptionSupported', () => {
  it('returns true for wildcard type "*/*"', () => {
    expect(isAudioTranscriptionSupported([MIME_TYPE_WILDCARD])).toBe(true);
  });

  it('returns true when array contains an audio MIME type', () => {
    expect(
      isAudioTranscriptionSupported([
        'image/png',
        `${MIME_TYPE_AUDIO_PREFIX}webm`,
      ]),
    ).toBe(true);
  });

  it('returns false when array contains no audio type', () => {
    expect(
      isAudioTranscriptionSupported(['image/png', 'application/pdf']),
    ).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isAudioTranscriptionSupported(undefined)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isAudioTranscriptionSupported([])).toBe(false);
  });
});
