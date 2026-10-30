import { Injectable, Logger } from '@nestjs/common';
import {
  extractDialErrorMessage,
  handleDialFetchError,
  mapDialHttpStatus,
} from '../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../common/utils/auth-header';
import { DialClientService } from '../dial/dial-client.service';
import { SchedulerConsentService } from '../external-services/scheduler-consent.service';
import { SchedulerServiceConsentStatus } from '../external-services/types/scheduler-service-consent-status.enum';
import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsSigninBodyDto,
} from './dto/offline-credentials.dto';
import {
  mapDialOfflineCredentialsToDto,
  toDialOfflineCredentialsSigninBody,
} from './offline-credentials.mapper';

/**
 * Bounds the scheduler-consent read that rides along on the status response:
 * a stalled scheduler-metadata response must not hold
 * `GET /api/v1/offline-credentials` open after Core has already returned the
 * credentials state — past this deadline the read defers as `unknown` and the
 * abort cancels the upstream lookup.
 */
export const SCHEDULER_CONSENT_READ_TIMEOUT_MS = 5_000;

/**
 * Proxies DIAL Core's per-user offline-credentials operations
 * (`GET /v1/user/offline-credentials`,
 * `POST /v1/user/offline-credentials/signin`) for the Scheduled Tasks
 * proactive-consent flow. Mirrors `ExternalServicesService`'s call pattern
 * and logging discipline — never logs the authorization `code` itself.
 */
@Injectable()
export class OfflineCredentialsService {
  private readonly logger = new Logger(OfflineCredentialsService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly schedulerConsentService: SchedulerConsentService,
  ) {}

  async getOfflineCredentialsStatus(
    accessToken: string,
  ): Promise<GetOfflineCredentialsResponseDto> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    this.logger.debug('Fetching offline-credentials status');

    try {
      /*
       * The consent read is independent of Core's status call and never
       * rejects, so both start at once — the status response pays one
       * round-trip of added latency instead of two in series. If the status
       * call fails, the read settles on its own and its result is dropped.
       */
      const consentRead = this.readSchedulerServiceConsent(accessToken);
      const response = await this.dialClient.client.getOfflineCredentials({
        headers: authHeaders,
      });
      if (response.error) {
        this.logger.debug(
          `DIAL Core getOfflineCredentials response: status=${response.response.status} error=${JSON.stringify(response.error)}`,
        );
        return mapDialHttpStatus(
          response.response.status,
          'get offline-credentials status',
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }

      this.logger.debug(
        `DIAL Core getOfflineCredentials response: status=${response.response.status} data=${JSON.stringify(response.data)}`,
      );
      const mapped = mapDialOfflineCredentialsToDto(response.data);
      this.logger.debug(
        `Mapped offline-credentials status: ${JSON.stringify(mapped)}`,
      );
      return {
        ...mapped,
        schedulerServiceConsent: await consentRead,
      };
    } catch (err) {
      return handleDialFetchError(
        err,
        'get offline-credentials status',
        this.logger,
        0,
      );
    }
  }

  /*
   * The scheduler service consent rides along on the status response; a
   * failed read (including missing scheduler configuration) must not fail
   * the status call itself — it logs a warn and defers as `unknown`. The
   * whole lookup is bounded by `SCHEDULER_CONSENT_READ_TIMEOUT_MS`: the
   * deadline aborts the upstream reads (primary and fallbacks) so a stalled
   * scheduler-metadata response cannot hold the status endpoint open.
   */
  private async readSchedulerServiceConsent(
    accessToken: string,
  ): Promise<SchedulerServiceConsentStatus> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      SCHEDULER_CONSENT_READ_TIMEOUT_MS,
    );
    try {
      return await this.schedulerConsentService.getSchedulerServiceConsent(
        accessToken,
        controller.signal,
      );
    } catch (err) {
      this.logger.warn(
        'Could not read the scheduler service consent; treating it as unknown',
        err instanceof Error ? err.message : undefined,
      );
      return SchedulerServiceConsentStatus.Unknown;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async signIn(
    accessToken: string,
    body: OfflineCredentialsSigninBodyDto,
  ): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    const dialBody = toDialOfflineCredentialsSigninBody(body);
    this.logger.debug(
      `Signing in offline-credentials: ${JSON.stringify({
        redirectUri: dialBody.redirectUri,
        codeLength: dialBody.code?.length,
      })}`,
    );

    try {
      const response = await this.dialClient.client.offlineCredentialsSignIn({
        headers: authHeaders,
        body: dialBody,
      });
      this.logger.debug(
        `DIAL Core offlineCredentialsSignIn response: status=${response.response.status} dataPresent=${response.data != null} errorPresent=${response.error != null}`,
      );
      if (response.error) {
        /*
         * The upstream error body is deliberately not passed as `errorBody`:
         * `mapDialHttpStatus` would log it verbatim, and the
         * `offline-credentials` spec forbids logging sign-in response
         * bodies. Only the status and operation context are logged; the
         * extracted message still becomes the client-facing exception text
         * where the mapper permits it.
         */
        return mapDialHttpStatus(
          response.response.status,
          'sign in offline-credentials',
          this.logger,
          undefined,
          extractDialErrorMessage(response.error),
        );
      }
      if (!response.data) {
        return mapDialHttpStatus(
          502,
          'sign in offline-credentials (Core reported failure)',
          this.logger,
        );
      }
      this.logger.debug('Signed in offline-credentials');
    } catch (err) {
      return handleDialFetchError(
        err,
        'sign in offline-credentials',
        this.logger,
        0,
      );
    }
  }

  /**
   * Revokes the user's stored offline-credentials grant by proxying DIAL Core
   * (`POST /v1/user/offline-credentials/signout`). A Core 404 is the
   * idempotent success state — there was no grant left to revoke.
   */
  async signOut(accessToken: string): Promise<void> {
    const authHeaders = getBearerAuthHeaders(accessToken);
    this.logger.debug('Signing out offline-credentials');

    try {
      const response = await this.dialClient.client.offlineCredentialsSignOut({
        headers: authHeaders,
      });
      this.logger.debug(
        `DIAL Core offlineCredentialsSignOut response: status=${response.response.status} errorPresent=${response.error != null}`,
      );
      /*
       * Mirrors ExternalServicesService.signOut: a 404 from Core means there
       * was no grant left to revoke, which is the idempotent success state a
       * sign-out call wants, not an error. Checked by status alone because
       * openapi-fetch leaves `error` empty for a bodiless non-OK response.
       */
      if (response.response.status === 404) {
        this.logger.debug('No offline-credentials grant left to revoke');
        return;
      }
      if (response.error || response.response.status >= 400) {
        return mapDialHttpStatus(
          response.response.status,
          'sign out offline-credentials',
          this.logger,
          response.error,
          extractDialErrorMessage(response.error),
        );
      }
      if (!response.error && !response.data) {
        return mapDialHttpStatus(
          502,
          'sign out offline-credentials (Core reported failure)',
          this.logger,
        );
      }
      this.logger.debug('Signed out offline-credentials');
    } catch (err) {
      return handleDialFetchError(
        err,
        'sign out offline-credentials',
        this.logger,
        0,
      );
    }
  }
}
