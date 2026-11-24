import { Logger } from '@nestjs/common';
import { UpstreamError, UpstreamFailure } from './content-provider';

const logger = new Logger('ContentSourcesUpstream');

export interface UpstreamRequest {
  readonly url: URL;
  /** Origin the URL must still have; guards against a divergent destination. */
  readonly origin: string;
  readonly headers: Record<string, string>;
  readonly timeoutMs: number;
  readonly maxBytes: number;
  /** Configured source id, used for logging only. */
  readonly sourceId: string;
}

export interface UpstreamResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: Buffer;
}

const readCapped = async (
  response: Response,
  maxBytes: number,
): Promise<Buffer> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError(
      UpstreamFailure.TooLarge,
      'Upstream body too large',
    );
  }
  if (!response.body) return Buffer.alloc(0);

  const chunks: Buffer[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new UpstreamError(
        UpstreamFailure.TooLarge,
        'Upstream body too large',
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
};

/**
 * One bounded GET to a configured repository host: deadline, no redirects,
 * byte cap, and a single place that classifies failures. Never logs the URL's
 * query, the headers or the body; credential problems log the source id and
 * status only.
 */
export const fetchUpstream = async (
  request: UpstreamRequest,
): Promise<UpstreamResponse> => {
  if (request.url.origin !== request.origin) {
    throw new Error('Content source destination escaped the configured origin');
  }

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch {
    throw new UpstreamError(
      UpstreamFailure.Unavailable,
      'Upstream is unreachable or timed out',
    );
  }

  const { status } = response;
  if (status >= 300 && status < 400) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError(
      UpstreamFailure.BadResponse,
      'Upstream redirected',
      status,
    );
  }
  if (status === 404) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError(UpstreamFailure.NotFound, 'Not found', status);
  }
  /*
   * GitHub answers an exhausted primary or secondary rate limit with 403, not
   * 429. That is the upstream throttling us, not a rejected credential.
   */
  const isRateLimited =
    status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' ||
      response.headers.has('retry-after'));
  if (isRateLimited) {
    await response.body?.cancel().catch(() => undefined);
    logger.warn(
      `Content source "${request.sourceId}" is rate limited by the upstream`,
    );
    throw new UpstreamError(
      UpstreamFailure.Unavailable,
      'Upstream is rate limiting',
      status,
    );
  }
  if (status === 401 || status === 403) {
    await response.body?.cancel().catch(() => undefined);
    logger.error(
      `Content source "${request.sourceId}" credential problem: upstream answered ${status}`,
    );
    throw new UpstreamError(
      UpstreamFailure.Credentials,
      'Upstream rejected the credentials',
      status,
    );
  }
  if (status === 429 || status === 503) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError(
      UpstreamFailure.Unavailable,
      'Upstream is rate limiting or unavailable',
      status,
    );
  }
  if (status < 200 || status >= 300) {
    await response.body?.cancel().catch(() => undefined);
    throw new UpstreamError(
      UpstreamFailure.BadResponse,
      'Upstream returned an error',
      status,
    );
  }

  try {
    return {
      status,
      headers: response.headers,
      body: await readCapped(response, request.maxBytes),
    };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(
      UpstreamFailure.Unavailable,
      'Upstream body could not be read',
    );
  }
};

/** Parses a JSON upstream body, mapping a malformed one to a bad response. */
export const parseUpstreamJson = <T>(body: Buffer): T => {
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch {
    throw new UpstreamError(
      UpstreamFailure.BadResponse,
      'Upstream returned invalid JSON',
    );
  }
};
