/** Host-owned recognition of the complete recording after capture stops. */
export type TranscribeAudio = (
  file: File,
  signal: AbortSignal,
) => Promise<string>;
