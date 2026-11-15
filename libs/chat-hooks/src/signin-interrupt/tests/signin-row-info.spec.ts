import type {
  DialToolsetDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { ExternalServiceCredentialsLevel } from '../../external-services/useExternalServiceLogin';
import { PendingSigninEventKind } from '../../shared/client-channel';
import {
  getSigninEventResourceKey,
  resolveExternalServiceSigninRowInfo,
  resolveToolsetSigninRowInfo,
} from '../signin-row-info';

const RESOURCE = 'https://mcp.notion.com/mcp';

describe('resolveToolsetSigninRowInfo', () => {
  it('carries the stored OAuth settings, including the resource, into the login settings', () => {
    const toolset = {
      id: 'toolsets/bucket/notion',
      toolset: 'toolsets/bucket/notion',
      displayName: 'Notion',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'dial-chat',
        authorizationEndpoint: 'https://mcp.notion.com/authorize',
        scopesSupported: ['read'],
        resource: RESOURCE,
      },
    } as DialToolsetDto;

    expect(
      resolveToolsetSigninRowInfo('toolsets/bucket/notion', toolset, 'en', 'en')
        .oauthSettings,
    ).toEqual({
      clientId: 'dial-chat',
      authorizationEndpoint: 'https://mcp.notion.com/authorize',
      scopes: ['read'],
      codeChallenge: undefined,
      codeChallengeMethod: undefined,
      resource: RESOURCE,
    });
  });

  it('resolves the display name for the active locale, then the primary locale', () => {
    const toolset = {
      id: 'toolsets/bucket/notion',
      toolset: 'toolsets/bucket/notion',
      displayName: { en: 'Notion', de: 'Notion DE' },
      displayVersion: '1.0',
    } as DialToolsetDto;

    expect(
      resolveToolsetSigninRowInfo(
        'toolsets/bucket/notion',
        toolset,
        'de',
        'en',
      ),
    ).toMatchObject({ displayName: 'Notion DE', displayVersion: '1.0' });
    expect(
      resolveToolsetSigninRowInfo('toolsets/bucket/notion', toolset, 'fr', 'en')
        .displayName,
    ).toBe('Notion');
  });

  it('falls back to a name derived from the toolset id while metadata is missing', () => {
    expect(
      resolveToolsetSigninRowInfo(
        'toolsets/bucket/My%20Toolset__1.0',
        undefined,
        'en',
        'en',
      ).displayName,
    ).toBe('My Toolset');
  });
});

describe('resolveExternalServiceSigninRowInfo', () => {
  it('carries the service resource into the login settings', () => {
    const service: GetExternalServiceResponseDto = {
      displayName: 'Notion',
      authenticationType: 'OAUTH',
      clientId: 'dial-chat',
      authorizationEndpoint: 'https://mcp.notion.com/authorize',
      resource: RESOURCE,
    };

    expect(
      resolveExternalServiceSigninRowInfo('notion', service).oauthSettings
        ?.resource,
    ).toBe(RESOURCE);
  });

  it('leaves the resource undefined when the service metadata is missing', () => {
    expect(
      resolveExternalServiceSigninRowInfo('notion', undefined).oauthSettings
        ?.resource,
    ).toBeUndefined();
  });

  it('targets the GLOBAL level only when the service is signed out at GLOBAL level alone', () => {
    expect(
      resolveExternalServiceSigninRowInfo('notion', {
        displayName: 'Notion',
        globalAuthStatus: 'SIGNED_OUT',
      } as GetExternalServiceResponseDto).credentialsLevel,
    ).toBe(ExternalServiceCredentialsLevel.Global);
    expect(
      resolveExternalServiceSigninRowInfo('notion', undefined).credentialsLevel,
    ).toBe(ExternalServiceCredentialsLevel.User);
  });
});

describe('getSigninEventResourceKey', () => {
  it('keys a toolset event by its toolset id', () => {
    expect(
      getSigninEventResourceKey({
        kind: PendingSigninEventKind.Toolset,
        id: 'evt-1',
        toolsetId: 'toolsets/bucket/notion',
      }),
    ).toBe('toolsets/bucket/notion');
  });

  it('keys an external-service event by its scope id', () => {
    expect(
      getSigninEventResourceKey({
        kind: PendingSigninEventKind.ExternalService,
        id: 'evt-1',
        appId: 'applications/bucket/app',
        serviceName: 'notion',
      }),
    ).toBe('applications/bucket/app/external_services/notion');
  });
});
