import { SchedulerServiceConsentStatus } from '@epam/ai-dial-chat-api-client';
import type {
  GetOfflineCredentialsResponseDto,
  OfflineCredentialsConnectDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  mapOfflineCredentialsResponse,
  normalizeOfflineCredentialsConnectSettings,
} from '../map-offline-credentials-response';

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
} satisfies OfflineCredentialsConnectDto;

describe('normalizeOfflineCredentialsConnectSettings', () => {
  it('normalizes a complete connect object', () => {
    expect(normalizeOfflineCredentialsConnectSettings(CONNECT)).toEqual(
      CONNECT,
    );
  });

  it('defaults an unset scopes list to empty', () => {
    expect(
      normalizeOfflineCredentialsConnectSettings({
        ...CONNECT,
        scopes: null,
      } as unknown as OfflineCredentialsConnectDto),
    ).toEqual({ ...CONNECT, scopes: [] });
  });

  it('returns undefined for a missing or incomplete connect object', () => {
    expect(
      normalizeOfflineCredentialsConnectSettings(undefined),
    ).toBeUndefined();
    /*
     * Incomplete objects are Core contract violations the presence check
     * guards against — the DTO marks both fields required.
     */
    expect(
      normalizeOfflineCredentialsConnectSettings({
        clientId: 'dial-apps',
      } as OfflineCredentialsConnectDto),
    ).toBeUndefined();
    expect(
      normalizeOfflineCredentialsConnectSettings({
        authorizationEndpoint: 'https://identity.example.com/authorize',
      } as OfflineCredentialsConnectDto),
    ).toBeUndefined();
  });
});

describe('mapOfflineCredentialsResponse', () => {
  it('carries the available and disconnected flags and the connect settings', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: false,
        connect: CONNECT,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
      }),
    ).toEqual({
      available: true,
      connected: false,
      connect: CONNECT,
      schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
    });
  });

  it('drops the connect settings while connected', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: true,
        connect: CONNECT,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
      }),
    ).toEqual({
      available: true,
      connected: true,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
    });
  });

  it('drops the connect settings while the service is unavailable', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: false,
        connected: false,
        connect: CONNECT,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
      }),
    ).toEqual({
      available: false,
      connected: false,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
    });
  });

  it('coalesces missing flags to false', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: null,
        connected: null,
      } as unknown as GetOfflineCredentialsResponseDto),
    ).toEqual({
      available: false,
      connected: false,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
    });
  });

  it('passes the scheduler service consent through unchanged', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: true,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedOut,
      }),
    ).toEqual({
      available: true,
      connected: true,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.SignedOut,
    });
  });

  it('defaults an absent consent value to unknown for an older BFF', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: false,
        connect: CONNECT,
        schedulerServiceConsent: null,
      } as unknown as GetOfflineCredentialsResponseDto),
    ).toEqual({
      available: true,
      connected: false,
      connect: CONNECT,
      schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
    });
  });

  it('defaults a value outside the enum to unknown', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: true,
        schedulerServiceConsent: 'SIGNED_OUT',
      } as unknown as GetOfflineCredentialsResponseDto),
    ).toEqual({
      available: true,
      connected: true,
      connect: undefined,
      schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
    });
  });
});
