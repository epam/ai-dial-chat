import type { DialToolsetDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  ToolsetAuthTypes,
  ToolsetTransportType,
  WithLogin,
} from '../../types/toolsets';
import type { ToolsetFormData } from '../../types/toolsets';
import {
  formToToolsetBody,
  getStorageSafeUniqueToolsetName,
  isValidEndpointUrl,
  toolsetDtoToForm,
} from '../toolsets';

const baseForm = (): ToolsetFormData => ({
  name: 'My toolset',
  version: '0.0.1',
  iconUrl: '',
  description: '',
  topics: [],
  endpoint: 'https://my-toolset.example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
});

describe('getStorageSafeUniqueToolsetName', () => {
  it('returns the default name when no collision exists', () => {
    expect(
      getStorageSafeUniqueToolsetName({
        defaultName: 'New toolset',
        existingNames: ['Other'],
      }),
    ).toBe('New toolset');
  });

  it('appends a numeric suffix when the default name is taken', () => {
    expect(
      getStorageSafeUniqueToolsetName({
        defaultName: 'New toolset',
        existingNames: ['New toolset', 'New toolset 1'],
      }),
    ).toBe('New toolset 2');
  });
});

describe('isValidEndpointUrl', () => {
  it('accepts http(s) and sse URLs', () => {
    expect(isValidEndpointUrl('https://example.com/mcp')).toBe(true);
    expect(isValidEndpointUrl('http://example.com')).toBe(true);
    expect(isValidEndpointUrl('sse://example.com/stream')).toBe(true);
  });

  it('rejects an unsupported protocol', () => {
    expect(isValidEndpointUrl('ftp://example.com')).toBe(false);
  });

  it('rejects a URL with a trailing dot or double slash', () => {
    expect(isValidEndpointUrl('https://example.com.')).toBe(false);
    expect(isValidEndpointUrl('https://example.com//')).toBe(false);
  });

  it('rejects an unparseable value', () => {
    expect(isValidEndpointUrl('not a url')).toBe(false);
  });
});

describe('formToToolsetBody', () => {
  it('maps form fields and omits empty optionals', () => {
    const body = formToToolsetBody(baseForm());
    expect(body).toMatchObject({
      name: 'My toolset',
      version: '0.0.1',
      endpoint: 'https://my-toolset.example.com/mcp',
      transport: ToolsetTransportType.Http,
      authSettings: { authenticationType: ToolsetAuthTypes.None },
    });
    expect(body.description).toBeUndefined();
    expect(body.topics).toBeUndefined();
  });

  it('includes the API key header when API_KEY auth is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithLogin,
      isLoggedIn: false,
      keyHeader: 'X-Api-Key',
      apiKey: 'secret',
    };
    const body = formToToolsetBody(form);
    expect(body.authSettings.apiKeyHeader).toBe('X-Api-Key');
  });

  it('includes OAuth config fields when OAuth auth is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client',
      clientSecret: 'secret',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      scopes: ['read'],
    };
    const body = formToToolsetBody(form);
    expect(body.authSettings).toMatchObject({
      authenticationType: ToolsetAuthTypes.OAuth,
      clientId: 'client',
      clientSecret: 'secret',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      scopesSupported: ['read'],
    });
  });
});

describe('toolsetDtoToForm', () => {
  it('maps a loaded DTO into editor form state', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      displayVersion: '1.2.3',
      description: 'desc',
      iconUrl: 'https://example.com/icon.svg',
      descriptionKeywords: ['a'],
      endpoint: 'https://my-toolset.example.com/mcp',
      transport: 'SSE',
      allowedTools: ['tool1'],
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        userLevelAuthStatus: 'SIGNED_IN',
      },
    };
    const form = toolsetDtoToForm(dto);
    expect(form).toMatchObject({
      name: 'My toolset',
      version: '1.2.3',
      endpoint: 'https://my-toolset.example.com/mcp',
      protocol: ToolsetTransportType.Sse,
      allowedTools: ['tool1'],
    });
    expect(form.auth.authenticationType).toBe(ToolsetAuthTypes.OAuth);
    expect(form.auth.withLogin).toBe(WithLogin.WithConfig);
    expect(form.auth.isLoggedIn).toBe(true);
  });

  it('defaults to NONE auth and HTTP transport when fields are absent', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/x__0.0.1',
      toolset: 'toolsets/b/x__0.0.1',
    };
    const form = toolsetDtoToForm(dto);
    expect(form.protocol).toBe(ToolsetTransportType.Http);
    expect(form.auth.authenticationType).toBe(ToolsetAuthTypes.None);
    expect(form.auth.isLoggedIn).toBe(false);
  });
});
