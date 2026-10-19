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
      }),
    ).toEqual({ available: true, connected: false, connect: CONNECT });
  });

  it('drops the connect settings while connected', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: true,
        connected: true,
        connect: CONNECT,
      }),
    ).toEqual({ available: true, connected: true, connect: undefined });
  });

  it('drops the connect settings while the service is unavailable', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: false,
        connected: false,
        connect: CONNECT,
      }),
    ).toEqual({ available: false, connected: false, connect: undefined });
  });

  it('coalesces missing flags to false', () => {
    expect(
      mapOfflineCredentialsResponse({
        available: null,
        connected: null,
      } as unknown as GetOfflineCredentialsResponseDto),
    ).toEqual({ available: false, connected: false, connect: undefined });
  });
});
