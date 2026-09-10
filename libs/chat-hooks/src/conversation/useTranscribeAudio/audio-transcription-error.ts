/** Reason a {@link useTranscribeAudio} call failed, translation-free — the host maps it to text. */
export enum AudioTranscriptionErrorReason {
  /** No usable ASR model or deployment is configured for the current bucket. */
  Unavailable = 'unavailable',
  /** The recording exceeds the caller's configured size limit. */
  TooLarge = 'tooLarge',
  /** The upstream ASR provider stayed rate-limited or unavailable after retrying. */
  Busy = 'busy',
  /** Recognition failed for any other reason. */
  Failed = 'failed',
}

/** Thrown by `transcribeAudio`; carries a machine-readable `reason` instead of translated text. */
export class AudioTranscriptionError extends Error {
  readonly reason: AudioTranscriptionErrorReason;
  /** The size limit that was exceeded, present only when `reason` is `TooLarge`. */
  readonly limitBytes?: number;

  constructor(reason: AudioTranscriptionErrorReason, limitBytes?: number) {
    super(reason);
    this.name = 'AudioTranscriptionError';
    this.reason = reason;
    this.limitBytes = limitBytes;
  }
}
