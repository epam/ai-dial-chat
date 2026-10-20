import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/environment.config';
import { ExternalServiceAuthType } from './dto/external-service.dto';
import { ExternalServicesService } from './external-services.service';
import { SchedulerServiceConsentStatus } from './types/scheduler-service-consent-status.enum';

/**
 * Reads the DIAL_NATIVE scheduler service's administrator-managed application
 * consent (Core's `auth_settings.app_level_auth_status`) for the scheduler
 * identity configured on `EnvironmentVariables`. Shared by the
 * scheduled-task mutation pre-check (`assertSchedulerConsent`) and the
 * offline-credentials status endpoint, so both apply one rule: only an
 * explicit `SIGNED_OUT` on a `DIAL_NATIVE` service means the consent is
 * missing; a failed lookup or an unreported status defers (`unknown`).
 * The consent is read fresh on every call — never cached.
 */
@Injectable()
export class SchedulerConsentService {
  private readonly logger = new Logger(SchedulerConsentService.name);
  private readonly schedulerAppId: string | undefined;
  private readonly schedulerServiceId: string | undefined;

  constructor(
    private readonly externalServicesService: ExternalServicesService,
    configService: ConfigService<EnvironmentVariables>,
  ) {
    this.schedulerAppId = configService.get('SCHEDULER_APP_ID', {
      infer: true,
    });
    this.schedulerServiceId = configService.get('SCHEDULER_SERVICE_ID', {
      infer: true,
    });
  }

  private getSchedulerAppId(): string {
    if (!this.schedulerAppId) {
      this.logger.error(
        'SCHEDULER_APP_ID is not configured — cannot read the scheduler service consent',
      );
      throw new ServiceUnavailableException(
        'Scheduled tasks are not configured (SCHEDULER_APP_ID is missing)',
      );
    }
    return this.schedulerAppId;
  }

  private getSchedulerServiceId(): string {
    if (!this.schedulerServiceId) {
      this.logger.error(
        'SCHEDULER_SERVICE_ID is not configured — cannot read the scheduler service consent',
      );
      throw new ServiceUnavailableException(
        'Scheduled tasks are not configured (SCHEDULER_SERVICE_ID is missing)',
      );
    }
    return this.schedulerServiceId;
  }

  /**
   * Resolves the scheduler service's consent state: `signed_out` only for an
   * explicit `SIGNED_OUT` on a `DIAL_NATIVE` service, `signed_in` for
   * `SIGNED_IN`, `unknown` for anything else (a failed lookup is logged at
   * warn and defers rather than failing the caller's operation).
   */
  async getSchedulerServiceConsent(
    accessToken: string,
  ): Promise<SchedulerServiceConsentStatus> {
    const appId = this.getSchedulerAppId();
    const serviceId = this.getSchedulerServiceId();

    let service;
    try {
      service = await this.externalServicesService.getExternalService(
        accessToken,
        appId,
        serviceId,
      );
    } catch (err) {
      this.logger.warn(
        `Could not read consent status of scheduler service "${serviceId}"; treating it as unknown`,
        err instanceof Error ? err.message : undefined,
      );
      return SchedulerServiceConsentStatus.Unknown;
    }

    if (service.appLevelAuthStatus === 'SIGNED_IN') {
      return SchedulerServiceConsentStatus.SignedIn;
    }
    if (
      service.authenticationType === ExternalServiceAuthType.DialNative &&
      service.appLevelAuthStatus === 'SIGNED_OUT'
    ) {
      return SchedulerServiceConsentStatus.SignedOut;
    }
    return SchedulerServiceConsentStatus.Unknown;
  }
}
