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

export const TRANSCRIBE_SIZE_LIMIT_MEGABYTES = 5;
// Maximum size for audio transcription requests (in bytes)
// Must match the sizeLimit in transcribe.ts API route config
export const TRANSCRIBE_SIZE_LIMIT_BYTES =
  TRANSCRIBE_SIZE_LIMIT_MEGABYTES * 1024 * 1024;
