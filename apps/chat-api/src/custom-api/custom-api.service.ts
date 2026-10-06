import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { mapDialHttpStatus } from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import {
  CustomApiOperation,
  resolveCustomApiDestination,
} from './custom-api-registry.service';
import {
  CustomApiTransportError,
  readBoundedJson,
} from './custom-api-response';

export interface CustomApiCallResult {
  readonly data: unknown;
  readonly bytes: number;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

/*
 * Upstream statuses that keep their status (with a generic BFF message).
 * Every other non-200 status becomes 502 — the shared `mapDialHttpStatus`
 * also passes 405/412/413 through, which this contract forbids.
 */
const RETAINED_UPSTREAM_STATUSES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 409, 422, 429,
]);

/** Non-standard "Client Closed Request" status; never reaches a client. */
export const CLIENT_CLOSED_REQUEST_STATUS = 499;

/**
 * Thrown when the caller disconnected before the Core call finished. The
 * response is never delivered; it lets the controller classify the outcome
 * without counting it as an upstream failure.
 */
export class CustomApiClientClosedException extends HttpException {
  constructor() {
    super('Client closed request', CLIENT_CLOSED_REQUEST_STATUS);
  }
}

/**
 * Dispatches one allowlisted GET call to Core using the caller's own access
 * token. See openspec/changes/archive/2026-10-02-add-configured-core-api-operations/design.md
 * §3 and §5 for the transport and error-mapping contract this implements.
 */
@Injectable()
export class CustomApiService {
  private readonly logger = new Logger(CustomApiService.name);

  constructor(private readonly dialClient: DialClientService) {}

  async callOperation(
    operation: CustomApiOperation,
    accessToken: string,
    clientSignal?: AbortSignal,
  ): Promise<CustomApiCallResult> {
    const context = `custom-api.${operation.id}`;
    if (clientSignal?.aborted) {
      throw new CustomApiClientClosedException();
    }
    const destination = resolveCustomApiDestination(
      this.dialClient.baseUrl,
      operation.corePath,
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), operation.timeoutMs);
    /* Either the deadline or a client disconnect aborts headers and body. */
    const signal = clientSignal
      ? AbortSignal.any([controller.signal, clientSignal])
      : controller.signal;

    try {
      const response = await this.dialClient.fetchCore(destination, {
        method: 'GET',
        redirect: 'manual',
        signal,
        headers: {
          Accept: 'application/json',
          ...getBearerAuthHeaders(accessToken),
        },
      });

      if (
        response.type === 'opaqueredirect' ||
        (response.status >= 300 && response.status < 400)
      ) {
        await response.body?.cancel().catch(() => undefined);
        this.logger.warn(`Core returned a redirect for ${context}`);
        throw new BadGatewayException(
          'DIAL Core returned an unsupported response',
        );
      }

      if (response.status !== 200) {
        await response.body?.cancel().catch(() => undefined);
        if (!RETAINED_UPSTREAM_STATUSES.has(response.status)) {
          this.logger.warn(
            `DIAL Core returned unsupported status ${response.status} for ${context}`,
          );
          throw new BadGatewayException(
            'DIAL Core returned an unsupported response',
          );
        }
        return mapDialHttpStatus(response.status, context, this.logger);
      }

      const { value, bytes } = await readBoundedJson(response, {
        maxBytes: operation.maxResponseBytes,
      });
      return { data: value, bytes };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      /*
       * Checked before the transport/timeout branches: once the client is
       * gone, whatever failed in flight is a consequence of that abort.
       */
      if (clientSignal?.aborted) {
        this.logger.debug(`${context} aborted: client disconnected`);
        throw new CustomApiClientClosedException();
      }
      if (error instanceof CustomApiTransportError) {
        this.logger.warn(`${context} transport rejection: ${error.kind}`);
        throw new BadGatewayException(
          'DIAL Core returned an invalid or oversized response',
        );
      }
      if (isAbortError(error)) {
        this.logger.warn(
          `${context} exceeded its ${operation.timeoutMs}ms deadline`,
        );
        throw new GatewayTimeoutException('DIAL Core request timed out');
      }
      this.logger.error(
        `${context} failed unexpectedly`,
        (error as Error)?.stack,
      );
      throw new ServiceUnavailableException(
        'DIAL Core is currently unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
