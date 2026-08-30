import { describe, expect, it } from 'vitest';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '../dto/external-service.dto';
import {
  mapDialExternalServiceToDto,
  toDialExternalServiceAppId,
  toDialExternalServiceSigninBody,
  toDialExternalServiceSignoutBody,
  toDialExternalServiceUrl,
} from '../external-services.mapper';

const APP_ID = 'applications/public/finhub-via-openapi__1.0.0';
const SERVICE_ID = 'finhub-api2';

describe('toDialExternalServiceUrl', () => {
  it('joins appId and serviceId with the external_services segment', () => {
    expect(toDialExternalServiceUrl(APP_ID, SERVICE_ID)).toBe(
      `${APP_ID}/external_services/${SERVICE_ID}`,
    );
  });
});

describe('toDialExternalServiceAppId', () => {
  it('strips the leading applications/ segment for the SDK getExternalService call', () => {
    expect(toDialExternalServiceAppId(APP_ID)).toBe(
      'public/finhub-via-openapi__1.0.0',
    );
  });

  it('returns the id unchanged when it has no applications/ prefix', () => {
    expect(toDialExternalServiceAppId('public/finhub-via-openapi__1.0.0')).toBe(
      'public/finhub-via-openapi__1.0.0',
    );
  });
});

describe('toDialExternalServiceSigninBody', () => {
  it('maps API_KEY credentials with the reconstructed scope id as url', () => {
    expect(
      toDialExternalServiceSigninBody(APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret',
      }),
    ).toEqual({
      url: `${APP_ID}/external_services/${SERVICE_ID}`,
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.ApiKey,
      apiKey: 'secret',
      code: undefined,
      redirectUri: undefined,
    });
  });

  it('maps OAUTH credentials with the reconstructed scope id as url', () => {
    expect(
      toDialExternalServiceSigninBody(APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.Global,
        authenticationType: ExternalServiceAuthType.OAuth,
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/callback',
      }),
    ).toEqual({
      url: `${APP_ID}/external_services/${SERVICE_ID}`,
      credentialsLevel: ExternalServiceCredentialsLevel.Global,
      authenticationType: ExternalServiceAuthType.OAuth,
      apiKey: undefined,
      code: 'auth-code',
      redirectUri: 'https://chat.example.com/callback',
    });
  });
});

describe('toDialExternalServiceSigninBody offline usage consent', () => {
  /*
   * Core gates every on-behalf-of mint on this flag, so an application that
   * works in the background cannot use a credential signed in without it —
   * the sign-in succeeds and the later mint fails with `consent-required`.
   */
  it('forwards the consent when the user granted it', () => {
    const body = toDialExternalServiceSigninBody(APP_ID, SERVICE_ID, {
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.OAuth,
      code: 'auth-code',
      redirectUri: 'https://chat.example.com/auth/toolset-signin',
      offlineUsageConsent: true,
    });

    expect(body.offlineUsageConsent).toBe(true);
  });

  it('forwards a declined consent as false rather than dropping it', () => {
    const body = toDialExternalServiceSigninBody(APP_ID, SERVICE_ID, {
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.ApiKey,
      apiKey: 'k',
      offlineUsageConsent: false,
    });

    expect(body.offlineUsageConsent).toBe(false);
  });

  it('leaves it undefined when the caller did not ask — never granted by default', () => {
    const body = toDialExternalServiceSigninBody(APP_ID, SERVICE_ID, {
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.ApiKey,
      apiKey: 'k',
    });

    expect(body.offlineUsageConsent).toBeUndefined();
  });
});

describe('toDialExternalServiceSignoutBody', () => {
  it('maps the sign-out request with the reconstructed scope id as url', () => {
    expect(
      toDialExternalServiceSignoutBody(APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.Application,
        authenticationType: ExternalServiceAuthType.OAuth,
      }),
    ).toEqual({
      url: `${APP_ID}/external_services/${SERVICE_ID}`,
      credentialsLevel: ExternalServiceCredentialsLevel.Application,
      authenticationType: ExternalServiceAuthType.OAuth,
    });
  });
});

describe('mapDialExternalServiceToDto', () => {
  it('maps a full Core response', () => {
    expect(
      mapDialExternalServiceToDto({
        display_name: 'FinHub API',
        description: 'Financial data lookup service',
        auth_settings: { authentication_type: 'API_KEY' },
      }),
    ).toEqual({
      displayName: 'FinHub API',
      description: 'Financial data lookup service',
      authenticationType: ExternalServiceAuthType.ApiKey,
    });
  });

  it('falls back to NONE when auth_settings is missing', () => {
    expect(mapDialExternalServiceToDto({ display_name: 'FinHub API' })).toEqual(
      {
        displayName: 'FinHub API',
        description: undefined,
        authenticationType: ExternalServiceAuthType.None,
      },
    );
  });

  it('falls back to an empty display name when Core omits it', () => {
    expect(mapDialExternalServiceToDto({})).toEqual({
      displayName: '',
      description: undefined,
      authenticationType: ExternalServiceAuthType.None,
    });
  });
});
