export enum AudioMimeType {
  OGG = 'audio/ogg',
  WEBM = 'audio/webm',
  MP4 = 'audio/mp4',
  WAV = 'audio/wav',
  MPEG = 'audio/mpeg',
  OPUS = 'audio/opus',
  AAC = 'audio/aac',
  FLAC = 'audio/flac',
  WMA = 'audio/wma',
}

// Maximum size for audio transcription requests in bytes (5 MB).
// Must match the sizeLimit in transcribe.ts API route config.
export const TRANSCRIBE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
