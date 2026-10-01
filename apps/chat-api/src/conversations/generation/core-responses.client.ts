import { Injectable, Logger } from '@nestjs/common';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { DialClientService } from '../../dial/dial-client.service';

/** Outcome of a call against a stored DIAL Core Responses job. */
export enum CoreResponseResultKind {
  Ok = 'ok',
  /** Core has no such response (expired, deleted, or never existed). */
  NotFound = 'not_found',
  /** The response belongs to another user (Core ownership check). */
  Forbidden = 'forbidden',
  /** `DELETE` on a job that is still running. */
  Active = 'active',
  /** Any other non-2xx answer or transport failure. */
  Error = 'error',
}

/** Status values DIAL Core reports for a stored response. */
export enum CoreResponseStatus {
  Queued = 'queued',
  InProgress = 'in_progress',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Failed = 'failed',
  Incomplete = 'incomplete',
}

/** The subset of a stored Responses object the background path reads. */
export interface CoreResponse {
  id: string;
  status: CoreResponseStatus | string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
}

export type CoreResponseResult =
  | { kind: CoreResponseResultKind.Ok; response: CoreResponse }
  | { kind: Exclude<CoreResponseResultKind, CoreResponseResultKind.Ok> };

export type CoreReplayResult =
  | { kind: CoreResponseResultKind.Ok; body: ReadableStream<Uint8Array> }
  | { kind: Exclude<CoreResponseResultKind, CoreResponseResultKind.Ok> };

type SdkResult = { data?: unknown; error?: unknown; response: Response };

const mapFailureStatus = (
  status: number,
): Exclude<CoreResponseResultKind, CoreResponseResultKind.Ok> => {
  switch (status) {
    case 404:
      return CoreResponseResultKind.NotFound;
    case 403:
      return CoreResponseResultKind.Forbidden;
    case 409:
      return CoreResponseResultKind.Active;
    default:
      return CoreResponseResultKind.Error;
  }
};

/**
 * App-edge wrapper around the DIAL SDK's stored-Responses operations (retrieve, replay,
 * cancel, delete). It is the only place that encodes `response_id` and forwards the
 * caller's bearer token for these calls, and it holds the single cast needed for
 * `?stream=true`: the installed `@epam/ai-dial-typescript-sdk` declares `query?: never`
 * for `getResponseItem` because DIAL Core's OpenAPI description omits the query
 * parameters it actually passes through. Remove the cast once the SDK types them.
 */
@Injectable()
export class CoreResponsesClient {
  private readonly logger = new Logger(CoreResponsesClient.name);

  constructor(private readonly dialClient: DialClientService) {}

  /**
   * Retrieves the stored response as JSON.
   * @param responseId - DIAL Core response id, as persisted on the message
   * @param token - the current request's bearer token
   */
  async retrieveResponse(
    responseId: string,
    token: string,
  ): Promise<CoreResponseResult> {
    const result = await this.call('retrieve', () =>
      this.dialClient.client.getResponseItem(encodeURIComponent(responseId), {
        headers: getBearerAuthHeaders(token),
      }),
    );
    if (result.kind !== CoreResponseResultKind.Ok) return result;
    if (!result.sdk.data) return { kind: CoreResponseResultKind.Error };
    return {
      kind: CoreResponseResultKind.Ok,
      response: result.sdk.data as CoreResponse,
    };
  }

  /**
   * Opens the stored response's event stream from its first event.
   * @param responseId - DIAL Core response id
   * @param token - the current request's bearer token
   * @param signal - aborts the upstream read
   */
  async replayResponse(
    responseId: string,
    token: string,
    signal: AbortSignal,
  ): Promise<CoreReplayResult> {
    const result = await this.call('replay', () =>
      this.dialClient.client.getResponseItem(encodeURIComponent(responseId), {
        headers: {
          ...getBearerAuthHeaders(token),
          Accept: 'text/event-stream',
        },
        params: { query: { stream: true } },
        parseAs: 'stream',
        signal,
      } as never),
    );
    if (result.kind !== CoreResponseResultKind.Ok) return result;
    const body = result.sdk.response.body;
    if (!body) return { kind: CoreResponseResultKind.Error };
    return { kind: CoreResponseResultKind.Ok, body };
  }

  /**
   * Requests cancellation of a running background job.
   * @param responseId - DIAL Core response id
   * @param token - the current request's bearer token
   */
  async cancelResponse(
    responseId: string,
    token: string,
  ): Promise<CoreResponseResult> {
    const result = await this.call('cancel', () =>
      this.dialClient.client.cancelResponseItem(
        encodeURIComponent(responseId),
        {
          headers: getBearerAuthHeaders(token),
        },
      ),
    );
    if (result.kind !== CoreResponseResultKind.Ok) return result;
    return {
      kind: CoreResponseResultKind.Ok,
      response: result.sdk.data as CoreResponse,
    };
  }

  /**
   * Deletes the stored response.
   * @param responseId - DIAL Core response id
   * @param token - the current request's bearer token
   */
  async deleteResponse(
    responseId: string,
    token: string,
  ): Promise<CoreResponseResultKind> {
    const result = await this.call('delete', () =>
      this.dialClient.client.deleteResponseItem(
        encodeURIComponent(responseId),
        {
          headers: getBearerAuthHeaders(token),
          parseAs: 'text',
        },
      ),
    );
    return result.kind;
  }

  private async call(
    operation: string,
    run: () => Promise<unknown>,
  ): Promise<
    | { kind: CoreResponseResultKind.Ok; sdk: SdkResult }
    | { kind: Exclude<CoreResponseResultKind, CoreResponseResultKind.Ok> }
  > {
    let sdk: SdkResult;
    try {
      sdk = (await run()) as SdkResult;
    } catch (err) {
      this.logger.warn(
        `DIAL Core ${operation} response failed: ${err instanceof Error ? err.name : 'unknown error'}`,
      );
      return { kind: CoreResponseResultKind.Error };
    }
    const status = sdk.response.status;
    if (sdk.response.ok) return { kind: CoreResponseResultKind.Ok, sdk };
    const kind = mapFailureStatus(status);
    this.logger.warn(`DIAL Core ${operation} response returned ${status}`);
    return { kind };
  }
}
