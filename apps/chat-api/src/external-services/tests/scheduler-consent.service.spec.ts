import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceAuthType } from '../dto/external-service.dto';
import { SchedulerConsentService } from '../scheduler-consent.service';
import { SchedulerServiceConsentStatus } from '../types/scheduler-service-consent-status.enum';

const APP_ID = 'scheduler-app';
const SERVICE_ID = 'my-oauth-service';

const makeConfigService = (schedulerAppId?: string) => ({
  get: vi.fn((key: string) => {
    const config: Record<string, unknown> = {
      SCHEDULER_APP_ID: schedulerAppId,
      SCHEDULER_SERVICE_ID: SERVICE_ID,
    };
    return config[key];
  }),
});

const makeExternalServices = (service: Record<string, unknown> = {}) => ({
  getExternalService: vi.fn().mockResolvedValue(service),
});

function makeService(externalServices = makeExternalServices()) {
  const service = new SchedulerConsentService(
    externalServices as never,
    makeConfigService(APP_ID) as never,
  );
  return { service, externalServices };
}

describe('SchedulerConsentService', () => {
  it('resolves the scheduler service from the configured identity', async () => {
    const { service, externalServices } = makeService(
      makeExternalServices({
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: 'SIGNED_IN',
      }),
    );

    await service.getSchedulerServiceConsent('token');

    expect(externalServices.getExternalService).toHaveBeenCalledWith(
      'token',
      APP_ID,
      SERVICE_ID,
    );
  });

  it('reports signed_in for an explicit SIGNED_IN status', async () => {
    const { service } = makeService(
      makeExternalServices({
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: 'SIGNED_IN',
      }),
    );

    await expect(service.getSchedulerServiceConsent('token')).resolves.toBe(
      SchedulerServiceConsentStatus.SignedIn,
    );
  });

  it('reports signed_out for a revoked SIGNED_OUT consent on a DIAL_NATIVE service', async () => {
    const { service } = makeService(
      makeExternalServices({
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: 'SIGNED_OUT',
      }),
    );

    await expect(service.getSchedulerServiceConsent('token')).resolves.toBe(
      SchedulerServiceConsentStatus.SignedOut,
    );
  });

  it.each([
    [
      'an OAuth scheduler service',
      { authenticationType: 'OAUTH', appLevelAuthStatus: 'SIGNED_OUT' },
    ],
    [
      'an unreported consent status',
      {
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: undefined,
      },
    ],
    [
      'an unexpected status value',
      {
        authenticationType: ExternalServiceAuthType.DialNative,
        appLevelAuthStatus: 'FAILED',
      },
    ],
  ])('reports unknown for %s', async (_name, service_) => {
    const { service } = makeService(makeExternalServices(service_));

    await expect(service.getSchedulerServiceConsent('token')).resolves.toBe(
      SchedulerServiceConsentStatus.Unknown,
    );
  });

  it('reports unknown without throwing when the consent lookup itself fails', async () => {
    const externalServices = makeExternalServices();
    externalServices.getExternalService.mockRejectedValue(
      new Error('core is down'),
    );
    const { service } = makeService(externalServices);

    await expect(service.getSchedulerServiceConsent('token')).resolves.toBe(
      SchedulerServiceConsentStatus.Unknown,
    );
  });

  it('throws ServiceUnavailableException when SCHEDULER_APP_ID is unset', async () => {
    /* Constructed inline: `makeService`'s default parameter would substitute
     * `APP_ID` for an explicitly passed `undefined`. */
    const externalServices = makeExternalServices();
    const service = new SchedulerConsentService(
      externalServices as never,
      makeConfigService(undefined) as never,
    );

    await expect(
      service.getSchedulerServiceConsent('token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(externalServices.getExternalService).not.toHaveBeenCalled();
  });
});
