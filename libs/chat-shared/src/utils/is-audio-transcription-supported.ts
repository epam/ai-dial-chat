import {
  MIME_TYPE_AUDIO_PREFIX,
  MIME_TYPE_WILDCARD,
} from '../constants/mime-types';

/** Returns `true` when `types` contains a wildcard or any audio MIME type; `false` otherwise. */
export const isAudioTranscriptionSupported = (types?: string[]): boolean =>
  types?.some(
    (t) => t === MIME_TYPE_WILDCARD || t.startsWith(MIME_TYPE_AUDIO_PREFIX),
  ) ?? false;
