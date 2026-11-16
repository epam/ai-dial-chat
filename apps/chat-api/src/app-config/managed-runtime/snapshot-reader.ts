import { Injectable } from '@nestjs/common';
import { getApiKeyAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';

/** The most response bytes one runtime read may return. */
export const MAX_RUNTIME_READ_BYTES = 131_072;

/** The deadline of one runtime read (Config Studio's per-call read deadline). */
export const RUNTIME_READ_TIMEOUT_MS = 5_000;

/** How one runtime read ended, before acceptance. */
export enum RuntimeReadKind {
  /** A 200 JSON object within the limit; acceptance decides. */
  Candidate = 'candidate',
  NotPublished = 'not_published',
  /** Core or Studio refused the reader key (401, 403, or a 404 without `not_published`). */
  Denied = 'denied',
  /** Studio reported its own published state inconsistent. */
  IntegrityMismatch = 'integrity_mismatch',
  /** Core or Studio unreachable, a 5xx, or the deadline passed. */
  Unavailable = 'unavailable',
  /** A body over the limit, a non-JSON body or an unexpected status. */
  Malformed = 'malformed',
  /** The caller aborted the read; its result must not be applied. */
  Aborted = 'aborted',
}

export type RuntimeReadResult =
  | { readonly kind: RuntimeReadKind.Candidate; readonly body: unknown }
  | {
      readonly kind: Exclude<
        RuntimeReadKind,
        RuntimeReadKind.Candidate | RuntimeReadKind.Aborted
      >;
      /** The upstream status, when one was received. */
      readonly status?: number;
    }
  | { readonly kind: RuntimeReadKind.Aborted };

/* Error bodies are small; reading more than this is never needed. */
const MAX_ERROR_BODY_BYTES = 4_096;

class BodyTooLargeError extends Error {}

/* Reads at most `limit` bytes of a body, cancelling the stream past it. */
const readLimited = async (
  response: globalThis.Response,
  limit: number,
): Promise<string> => {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const hasCode = (body: unknown, code: string): boolean =>
  body !== null &&
  typeof body === 'object' &&
  (body as Record<string, unknown>)['code'] === code;

/**
 * Reads one Config Studio instance's published snapshot through DIAL Core,
 * `GET /v1/deployments/<instance>/route/v1/published`, with Chat's own reader
 * key and nothing from any user session. A raw `fetch` is used because the
 * DIAL SDK has no deployment-route operation (as in
 * `DeploymentRouteController`). The caller owns the deadline through
 * `signal`, so a timed-out read and an abandoned refresh look the same.
 */
@Injectable()
export class ManagedSnapshotReader {
  constructor(private readonly dialClient: DialClientService) {}

  async read(
    instanceId: string,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<RuntimeReadResult> {
    const url = `${this.dialClient.baseUrl.replace(/\/+$/, '')}/v1/deployments/${encodeURIComponent(instanceId)}/route/v1/published`;
    try {
      const response = await this.dialClient.fetchCore(url, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          Accept: 'application/json',
          ...getApiKeyAuthHeaders(apiKey),
        },
      });
      return await this.classify(response, signal);
    } catch (error) {
      if (signal.aborted) return { kind: RuntimeReadKind.Aborted };
      if (error instanceof BodyTooLargeError) {
        return { kind: RuntimeReadKind.Malformed, status: 200 };
      }
      return { kind: RuntimeReadKind.Unavailable };
    }
  }

  private async classify(
    response: globalThis.Response,
    signal: AbortSignal,
  ): Promise<RuntimeReadResult> {
    const { status } = response;
    if (status === 200) {
      const body = parseJson(
        await readLimited(response, MAX_RUNTIME_READ_BYTES),
      );
      return body !== null && typeof body === 'object' && !Array.isArray(body)
        ? { kind: RuntimeReadKind.Candidate, body }
        : { kind: RuntimeReadKind.Malformed, status };
    }
    if (status === 404 || status === 502) {
      const body = parseJson(
        await readLimited(response, MAX_ERROR_BODY_BYTES).catch(() => ''),
      );
      /* An abort while reading the error body ends the read, not a denial. */
      if (signal.aborted) return { kind: RuntimeReadKind.Aborted };
      if (status === 404) {
        return hasCode(body, 'not_published')
          ? { kind: RuntimeReadKind.NotPublished, status }
          : { kind: RuntimeReadKind.Denied, status };
      }
      if (hasCode(body, 'integrity_mismatch')) {
        return { kind: RuntimeReadKind.IntegrityMismatch, status };
      }
      return { kind: RuntimeReadKind.Unavailable, status };
    }
    await response.body?.cancel().catch(() => undefined);
    if (status === 401 || status === 403) {
      return { kind: RuntimeReadKind.Denied, status };
    }
    if (status >= 500) {
      return { kind: RuntimeReadKind.Unavailable, status };
    }
    return { kind: RuntimeReadKind.Malformed, status };
  }
}
