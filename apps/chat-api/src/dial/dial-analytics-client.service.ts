import {
  createAnalyticsSDK,
  type DIAL_ANALYTICS_SDK,
} from '@epam/ai-dial-typescript-sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StringUtils } from '../common/utils/string-utils';
import { buildChatUserAgent } from '../common/utils/user-agent';
import { EnvironmentVariables } from '../config/environment.config';
import { withAnalyticsRequestTiming } from '../telemetry/upstream-request-timing';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Owns the process-wide DIAL Analytics (ADAS) SDK client, the counterpart of
 * `DialClientService` for DIAL Core. Without `ANALYTICS_URL` no client exists
 * and no call can be made. The client's transport never follows a redirect
 * with the caller's token, aborts each call after `ANALYTICS_TIMEOUT_MS`
 * (body included) or when the caller's own signal aborts, sends the Chat
 * product User-Agent, logs each ADAS status and discards an error body
 * unread. It carries no credential of its own: every call passes the caller's
 * bearer headers. Its wire time is recorded as the `analytics` request-timing
 * phase, apart from DIAL Core and Chat time. See
 * openspec/changes/archive/2026-11-26-integrate-dial-analytics-sdk/design.md (D2, D3).
 */
@Injectable()
export class DialAnalyticsClientService {
  private readonly logger = new Logger(DialAnalyticsClientService.name);
  private readonly sdk: DIAL_ANALYTICS_SDK | undefined;
  private readonly baseUrl: string | undefined;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(configService: ConfigService<EnvironmentVariables>) {
    this.baseUrl =
      StringUtils.stripTrailingSlashes(
        configService.get('ANALYTICS_URL', { infer: true })?.trim() ?? '',
      ) || undefined;
    this.timeoutMs =
      configService.get('ANALYTICS_TIMEOUT_MS', { infer: true }) ??
      DEFAULT_TIMEOUT_MS;
    this.userAgent = buildChatUserAgent(
      configService.get('CHAT_VERSION', { infer: true }),
    );
    this.sdk =
      this.baseUrl === undefined
        ? undefined
        : createAnalyticsSDK({
            baseUrl: this.baseUrl,
            fetch: this.fetchAnalytics,
          });
  }

  /** Whether `ANALYTICS_URL` is set; without it no call may be made. */
  get isConfigured(): boolean {
    return this.sdk !== undefined;
  }

  /** The typed ADAS client; callers check `isConfigured` first. */
  get client(): DIAL_ANALYTICS_SDK {
    if (this.sdk === undefined) {
      throw new Error('DIAL Analytics: ANALYTICS_URL is not configured');
    }
    return this.sdk;
  }

  private readonly fetchAnalytics: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : undefined;
    const headers = new Headers(init?.headers ?? request?.headers);
    headers.set('User-Agent', this.userAgent);
    /* A call that negotiates another type (the CSV endpoints) keeps its own. */
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    const method = init?.method ?? request?.method ?? 'GET';
    const url = request?.url ?? String(input);
    const base = this.baseUrl ?? '';
    const path = url.startsWith(base) ? url.slice(base.length) : url;
    /* Stays armed while the SDK reads the body, so a stalled body times out too. */
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const callerSignal = init?.signal ?? request?.signal;
    const startedAt = Date.now();

    /* Only the wire call is marked: its interval ends with the body or its cancel. */
    const response = await withAnalyticsRequestTiming(() =>
      globalThis.fetch(input, {
        ...init,
        headers,
        /* A redirect never decides where the caller's token goes. */
        redirect: 'manual',
        signal: callerSignal
          ? AbortSignal.any([timeout, callerSignal])
          : timeout,
      }),
    );

    const outcome = `DIAL Analytics ${method} ${path} answered ${response.status} in ${Date.now() - startedAt}ms`;
    if (response.ok) {
      this.logger.debug(outcome);
      return response;
    }
    /* The raw ADAS status: the mapped exception no longer carries it. */
    this.logger.warn(outcome);
    /*
     * The error body is never logged or exposed, so it is never read either:
     * an ingress page or a large body costs nothing on the failure path.
     */
    await response.body?.cancel();
    return new Response(null, {
      status: response.status,
      statusText: response.statusText,
    });
  };
}
