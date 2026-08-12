import { describe, expect, it } from 'vitest';
import {
  mapDialOfflineCredentialsToDto,
  toDialOfflineCredentialsSigninBody,
} from '../offline-credentials.mapper';

describe('mapDialOfflineCredentialsToDto', () => {
  it('maps a full Core response with connect present', () => {
    expect(
      mapDialOfflineCredentialsToDto({
        available: true,
        connected: false,
        connect: {
          authorization_endpoint: 'https://identity.example.com/authorize',
          client_id: 'dial-chat',
          redirect_uri: 'https://chat.example.com/auth/toolset-signin',
          scopes: ['openid', 'offline_access'],
        },
      }),
    ).toEqual({
      available: true,
      connected: false,
      connect: {
        authorizationEndpoint: 'https://identity.example.com/authorize',
        clientId: 'dial-chat',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
        scopes: ['openid', 'offline_access'],
      },
    });
  });

  it('omits connect when already connected', () => {
    expect(
      mapDialOfflineCredentialsToDto({ available: true, connected: true }),
    ).toEqual({ available: true, connected: true });
  });

  it('applies safe defaults when available/connected/connect are all missing', () => {
    expect(mapDialOfflineCredentialsToDto({})).toEqual({
      available: false,
      connected: false,
    });
  });

  it('omits connect when required connect sub-fields are missing', () => {
    expect(
      mapDialOfflineCredentialsToDto({
        available: true,
        connected: false,
        connect: { authorization_endpoint: 'https://identity.example.com' },
      }),
    ).toEqual({ available: true, connected: false });
  });

  it('defaults scopes to an empty array when Core omits them', () => {
    expect(
      mapDialOfflineCredentialsToDto({
        available: true,
        connected: false,
        connect: {
          authorization_endpoint: 'https://identity.example.com/authorize',
          client_id: 'dial-chat',
          redirect_uri: 'https://chat.example.com/auth/toolset-signin',
        },
      }),
    ).toEqual({
      available: true,
      connected: false,
      connect: {
        authorizationEndpoint: 'https://identity.example.com/authorize',
        clientId: 'dial-chat',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
        scopes: [],
      },
    });
  });
});

describe('toDialOfflineCredentialsSigninBody', () => {
  it('maps the BFF body to the SDK request shape', () => {
    expect(
      toDialOfflineCredentialsSigninBody({
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
      }),
    ).toEqual({
      code: 'auth-code',
      redirectUri: 'https://chat.example.com/auth/toolset-signin',
    });
  });
});
