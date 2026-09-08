import type { DialToolsetDto } from '@epam/ai-dial-chat-api-client';
import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import type { ToolsetFormData } from '@epam/ai-dial-toolset-editor';
import { ToolsetTransportType } from '@epam/ai-dial-toolset-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as toolsetsApi from '../../server-api/toolsets';
import {
  extractToolsetApiErrorMessage,
  fetchToolsetAuthSettings,
  formToToolsetBody,
  toolsetDtoToForm,
} from '../toolsets';

vi.mock('../../server-api/toolsets', () => ({
  getToolset: vi.fn(),
}));

const baseForm = (): ToolsetFormData => ({
  name: 'My toolset',
  version: '0.0.1',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
  endpoint: 'https://my-toolset.example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
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

  it('includes the API key header when API_KEY without login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithoutLogin,
      isLoggedIn: false,
      keyHeader: 'X-Api-Key',
    };
    const body = formToToolsetBody(form);
    expect(body.authSettings).toMatchObject({
      authenticationType: ToolsetAuthTypes.ApiKey,
      apiKeyHeader: 'X-Api-Key',
    });
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
      tokenEndpoint: 'https://auth.example.com/token',
      scopes: ['read'],
    };
    const body = formToToolsetBody(
      form,
      'https://chat.example.com/auth/toolset-signin',
    );
    expect(body.authSettings).toMatchObject({
      authenticationType: ToolsetAuthTypes.OAuth,
      clientId: 'client',
      clientSecret: 'secret',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      redirectUri: 'https://chat.example.com/auth/toolset-signin',
      scopesSupported: ['read'],
    });
  });

  it('includes the OAuth redirect URI when OAuth with login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithLogin,
      isLoggedIn: false,
    };

    const body = formToToolsetBody(
      form,
      'https://chat.example.com/auth/toolset-signin',
    );

    expect(body.authSettings).toMatchObject({
      authenticationType: ToolsetAuthTypes.OAuth,
      redirectUri: 'https://chat.example.com/auth/toolset-signin',
    });
  });

  it('repairs encoded endpoint URLs before building the request body', () => {
    const form = baseForm();
    form.endpoint = 'https%3A/my-toolset.example.com/mcp';
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client',
      clientSecret: 'secret',
      authorizationEndpoint: 'https%3A/auth.example.com/authorize',
      tokenEndpoint: 'https%3A%2F%2Fauth.example.com%2Ftoken',
    };

    const body = formToToolsetBody(form);

    expect(body.endpoint).toBe('https://my-toolset.example.com/mcp');
    expect(body.authSettings.authorizationEndpoint).toBe(
      'https://auth.example.com/authorize',
    );
    expect(body.authSettings.tokenEndpoint).toBe(
      'https://auth.example.com/token',
    );
  });

  it('omits locales and primaryLocale when otherLocales is empty', () => {
    const body = formToToolsetBody(baseForm());
    expect(body.locales).toBeUndefined();
    expect(body.primaryLocale).toBeUndefined();
  });

  it('includes locales and primaryLocale when otherLocales has entries', () => {
    const form = baseForm();
    form.otherLocales = [
      {
        id: 'locale-row-1',
        language: 'de',
        name: 'Mein Toolset',
        description: 'Eine Beschreibung',
      },
    ];
    const body = formToToolsetBody(form);
    expect(body.primaryLocale).toBe('en');
    expect(body.locales).toEqual([
      {
        language: 'de',
        name: 'Mein Toolset',
        description: 'Eine Beschreibung',
      },
    ]);
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
        dynamicallyRegistered: false,
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
        scopesSupported: ['read', 'write'],
        codeChallenge: 'challenge-value',
        codeChallengeMethod: 'S256',
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
    expect(form.auth).toMatchObject({
      clientId: 'client',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
      scopes: ['read', 'write'],
      codeChallenge: 'challenge-value',
      codeChallengeMethod: 'S256',
    });
    expect(form.auth.clientSecret).toBeUndefined();
  });

  it('decomposes a localized displayName/description into otherLocales, resolving the primary field to the primary locale', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: { en: 'My toolset', de: 'Mein Toolset' },
      description: { en: 'A description', de: 'Eine Beschreibung' },
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: { authenticationType: 'NONE' },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.name).toBe('My toolset');
    expect(form.description).toBe('A description');
    expect(form.otherLocales).toEqual([
      expect.objectContaining({
        language: 'de',
        name: 'Mein Toolset',
        description: 'Eine Beschreibung',
      }),
    ]);
  });

  it('returns an empty otherLocales array when displayName/description are plain strings', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      description: 'A description',
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: { authenticationType: 'NONE' },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.otherLocales).toEqual([]);
  });

  it('restores WithLogin for a dynamically registered OAuth client', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: {
        authenticationType: 'OAUTH',
        dynamicallyRegistered: true,
        clientId: 'dynamically-registered-client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
      },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.auth.withLogin).toBe(WithLogin.WithLogin);
    expect(form.auth.clientId).toBe('dynamically-registered-client');
  });

  it('repairs encoded endpoint URLs returned from the API before showing them in the editor', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      endpoint: 'https%3A/my-toolset.example.com/mcp',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        authorizationEndpoint: 'https%3A/auth.example.com/authorize',
        tokenEndpoint: 'https%3A%2F%2Fauth.example.com%2Ftoken',
      },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.endpoint).toBe('https://my-toolset.example.com/mcp');
    expect(form.auth.authorizationEndpoint).toBe(
      'https://auth.example.com/authorize',
    );
    expect(form.auth.tokenEndpoint).toBe('https://auth.example.com/token');
  });

  it('maps the API key header into editor form state without exposing the key value', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: {
        authenticationType: 'API_KEY',
        apiKeyHeader: 'X-Api-Key',
      },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.auth.authenticationType).toBe(ToolsetAuthTypes.ApiKey);
    expect(form.auth.withLogin).toBe(WithLogin.WithLogin);
    expect(form.auth.keyHeader).toBe('X-Api-Key');
    expect(form.auth.apiKey).toBeUndefined();
  });

  it('does not mark the form as logged in when only the global auth status is signed in', () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/My%20toolset__0.0.1',
      toolset: 'toolsets/b/My%20toolset__0.0.1',
      displayName: 'My toolset',
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client',
        globalAuthStatus: 'SIGNED_IN',
      },
    };

    const form = toolsetDtoToForm(dto);

    expect(form.auth.isLoggedIn).toBe(false);
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

describe('fetchToolsetAuthSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the toolset and maps its authSettings the same way toolsetDtoToForm does', async () => {
    const dto: DialToolsetDto = {
      id: 'toolsets/b/newly-created',
      toolset: 'toolsets/b/newly-created',
      displayName: 'My toolset',
      endpoint: 'https://my-toolset.example.com/mcp',
      authSettings: {
        authenticationType: 'OAUTH',
        dynamicallyRegistered: true,
        clientId: 'dcr-client-id',
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
    };
    vi.mocked(toolsetsApi.getToolset).mockResolvedValue(dto);

    const auth = await fetchToolsetAuthSettings('toolsets/b/newly-created');

    expect(toolsetsApi.getToolset).toHaveBeenCalledWith(
      'toolsets/b/newly-created',
    );
    expect(auth).toEqual(toolsetDtoToForm(dto).auth);
    expect(auth.clientId).toBe('dcr-client-id');
    expect(auth.authorizationEndpoint).toBe(
      'https://auth.example.com/authorize',
    );
  });

  it('propagates a fetch failure to the caller', async () => {
    vi.mocked(toolsetsApi.getToolset).mockRejectedValue(new Error('fail'));

    await expect(
      fetchToolsetAuthSettings('toolsets/b/newly-created'),
    ).rejects.toThrow('fail');
  });
});

describe('extractToolsetApiErrorMessage', () => {
  it('returns the message from a ResponseError JSON body', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 400,
        message:
          "The specified endpoint 'https://test.com' is invalid or unreachable.",
        error: 'Bad Request',
      }),
      { status: 400 },
    );
    const error = new ResponseError(response);

    await expect(extractToolsetApiErrorMessage(error)).resolves.toBe(
      "The specified endpoint 'https://test.com' is invalid or unreachable.",
    );
  });

  it('joins an array message body into a single string', async () => {
    const response = new Response(
      JSON.stringify({ message: ['name is required', 'endpoint is required'] }),
      { status: 400 },
    );
    const error = new ResponseError(response);

    await expect(extractToolsetApiErrorMessage(error)).resolves.toBe(
      'name is required, endpoint is required',
    );
  });

  it('returns undefined for non-ResponseError errors', async () => {
    await expect(
      extractToolsetApiErrorMessage(new Error('boom')),
    ).resolves.toBeUndefined();
  });

  it('returns undefined when the response body has no readable message', async () => {
    const response = new Response(JSON.stringify({ statusCode: 400 }), {
      status: 400,
    });
    const error = new ResponseError(response);

    await expect(extractToolsetApiErrorMessage(error)).resolves.toBeUndefined();
  });

  it('returns undefined when the response body is not valid JSON', async () => {
    const response = new Response('not json', { status: 400 });
    const error = new ResponseError(response);

    await expect(extractToolsetApiErrorMessage(error)).resolves.toBeUndefined();
  });
});
