import type {
  DialToolsetDto,
  GetExternalServiceResponseDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  resolveExternalServiceInfo,
  resolveToolsetInfo,
} from '../signin-interrupt';

const RESOURCE = 'https://mcp.notion.com/mcp';

describe('resolveToolsetInfo', () => {
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
      resolveToolsetInfo('toolsets/bucket/notion', toolset).oauthSettings,
    ).toEqual({
      clientId: 'dial-chat',
      authorizationEndpoint: 'https://mcp.notion.com/authorize',
      scopes: ['read'],
      codeChallenge: undefined,
      codeChallengeMethod: undefined,
      resource: RESOURCE,
    });
  });
});

describe('resolveExternalServiceInfo', () => {
  it('carries the service resource into the login settings', () => {
    const service: GetExternalServiceResponseDto = {
      displayName: 'Notion',
      authenticationType: 'OAUTH',
      clientId: 'dial-chat',
      authorizationEndpoint: 'https://mcp.notion.com/authorize',
      resource: RESOURCE,
    };

    expect(
      resolveExternalServiceInfo('notion', service).oauthSettings?.resource,
    ).toBe(RESOURCE);
  });

  it('leaves the resource undefined when the service metadata is missing', () => {
    expect(
      resolveExternalServiceInfo('notion', undefined).oauthSettings?.resource,
    ).toBeUndefined();
  });
});
