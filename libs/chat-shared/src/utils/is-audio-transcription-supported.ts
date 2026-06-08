/** Returns `true` when `types` contains a wildcard or any audio MIME type; `false` otherwise. */
export const isAudioTranscriptionSupported = (types?: string[]): boolean =>
  types?.some((t) => t === '*/*' || t.startsWith('audio/')) ?? false;
