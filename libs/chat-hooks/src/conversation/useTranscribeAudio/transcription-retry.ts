import {
  AudioTranscriptionError,
  AudioTranscriptionErrorReason,
} from './audio-transcription-error';

const MAX_RETRIES = 2;
const MAX_TOTAL_WAIT_MS = 90_000;

const waitForRetry = (delay: number, signal: AbortSignal): Promise<void> => {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

const retryAfterMs = (header: string | null): number | undefined => {
  if (!header?.trim()) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds))
    return seconds >= 0 ? seconds * 1000 : undefined;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
};

/* Retry recognition of the complete recording without uploading it again. */
export const withTranscriptionRetry = async (
  recognize: () => Promise<string>,
  signal: AbortSignal,
): Promise<string> => {
  let totalWait = 0;
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await recognize();
    } catch (error) {
      signal.throwIfAborted();
      const response =
        error != null && typeof error === 'object' && 'response' in error
          ? error.response
          : undefined;
      if (
        !(response instanceof Response) ||
        ![429, 502, 503, 504].includes(response.status)
      ) {
        throw error;
      }
      /* Core uses a 30-second cooldown for upstream rate limits when the
       * provider supplies no Retry-After; short retries only add more load. */
      const fallback = [429, 503].includes(response.status) ? 30_000 : 2000;
      const delay = Math.max(
        1000,
        retryAfterMs(response.headers.get('retry-after')) ??
          fallback * 2 ** attempt,
      );
      if (attempt >= MAX_RETRIES || totalWait + delay > MAX_TOTAL_WAIT_MS) {
        throw new AudioTranscriptionError(AudioTranscriptionErrorReason.Busy);
      }
      totalWait += delay;
      await waitForRetry(delay, signal);
    }
  }
};
