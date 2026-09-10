import { ServiceUnavailableException } from '@nestjs/common';

export class TranscriptionUnavailableException extends ServiceUnavailableException {
  constructor(readonly retryAfter: string | null) {
    super(
      'Audio transcription is temporarily unavailable. Please try again later.',
    );
  }
}
