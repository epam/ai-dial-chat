import type { DialToolsetDto } from '@epam/chat-api-client';
import { ResponseError } from '@epam/chat-api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetOAuthFailureReason,
  ToolsetOAuthInitiationResultType,
  ToolsetOAuthResultType,
  ToolsetTransportType,
  WithLogin,
} from '../../types/toolsets';
import type { ToolsetFormData } from '../../types/toolsets';
import {
  buildToolsetAuthorizeUrl,
  encodeToolsetId,
  extractToolsetApiErrorMessage,
  formToToolsetBody,
  getStorageSafeUniqueToolsetName,
  getToolsetOAuthChannelName,
  initiateOAuthLogin,
  isToolsetAuthValid,
  isToolsetFormValid,
  isValidEndpointUrl,
  navigateToolsetOAuthPopup,
  openToolsetOAuthPopup,
  toolsetDtoToForm,
  waitForToolsetOAuthResult,
} from '../toolsets';

/** Minimal fake popup `Window` — enough surface for `initiateOAuthLogin`/`waitForToolsetOAuthResult`. */
const makeFakePopup = () => ({
  sessionStorage: {
    store: new Map<string, string>(),
    setItem(key: string, value: string) {
      this.store.set(key, value);
    },
    getItem(key: string) {
      return this.store.get(key) ?? null;
    },
  },
  location: { href: '' },
  opener: window,
  closed: false,
  close: vi.fn(),
});

const validOAuthConfig = {
  authenticationType: ToolsetAuthTypes.OAuth,
  withLogin: WithLogin.WithConfig,
  isLoggedIn: false,
  clientId: 'client',
  authorizationEndpoint: 'https://auth.example.com/authorize',
};

const baseForm = (): ToolsetFormData => ({
  name: 'My toolset',
  version: '0.0.1',
  iconUrl: '',
  description: '',
  topics: [],
  intro: '',
  endpoint: 'https://my-toolset.example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
});

describe('encodeToolsetId', () => {
  it('percent-encodes each segment but keeps / as a literal separator', () => {
    expect(encodeToolsetId('toolsets/b/My Toolset__1.0.0')).toBe(
      'toolsets/b/My%20Toolset__1.0.0',
    );
  });

  it('double-encodes an already-percent-encoded id (must only ever be called on the raw id)', () => {
    expect(encodeToolsetId('toolsets/b/My%20Toolset__1.0.0')).toBe(
      'toolsets/b/My%2520Toolset__1.0.0',
    );
  });

  it('is a no-op for an id with no reserved characters', () => {
    expect(encodeToolsetId('toolsets/b/my__1.0.0')).toBe(
      'toolsets/b/my__1.0.0',
    );
  });
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

describe('isToolsetFormValid', () => {
  it('accepts a complete form with no auth requirements', () => {
    expect(isToolsetFormValid(baseForm())).toBe(true);
  });

  it('requires a name and a valid endpoint URL', () => {
    const form = baseForm();
    form.name = '';
    expect(isToolsetFormValid(form)).toBe(false);

    form.name = 'My toolset';
    form.endpoint = '';
    expect(isToolsetFormValid(form)).toBe(false);

    form.endpoint = 'not a url';
    expect(isToolsetFormValid(form)).toBe(false);
  });

  it('requires API key fields when API-key login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithLogin,
      isLoggedIn: false,
      keyHeader: 'X-API-Key',
      apiKey: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.apiKey = 'secret';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('requires the API key header when API-key without login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithoutLogin,
      isLoggedIn: false,
      keyHeader: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.keyHeader = 'X-API-Key';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('requires a client id and secret when configured OAuth is selected, but not the endpoints', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.clientSecret = 'client-secret';
    expect(isToolsetFormValid(form)).toBe(true);

    form.auth.authorizationEndpoint = 'https://auth.example.com/authorize';
    form.auth.tokenEndpoint = 'https://auth.example.com/token';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('does not require a client secret for configured OAuth when editing an existing toolset', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: '',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
    };

    expect(isToolsetFormValid(form)).toBe(false);
    expect(isToolsetFormValid(form, true)).toBe(true);
  });

  it('requires valid OAuth endpoint URLs when they are provided', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      authorizationEndpoint: 'not a url',
      tokenEndpoint: 'https://auth.example.com/token',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.authorizationEndpoint = 'https://auth.example.com/authorize';
    form.auth.tokenEndpoint = 'not a url';
    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.tokenEndpoint = 'https://auth.example.com/token';
    expect(isToolsetFormValid(form)).toBe(true);
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
    expect(body.intro).toBeUndefined();
  });

  it('includes a trimmed intro when provided', () => {
    const form = baseForm();
    form.intro = '  A short pitch  ';
    const body = formToToolsetBody(form);
    expect(body.intro).toBe('A short pitch');
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
});

describe('buildToolsetAuthorizeUrl', () => {
  it('builds an OAuth authorize URL with the given state and scopes', () => {
    const result = buildToolsetAuthorizeUrl(
      {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        scopes: ['read', 'write'],
      },
      'http://localhost/auth/toolset-signin',
      'encoded-state',
    );

    expect(result).not.toBeNull();
    const url = new URL(result ?? '');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client');
    expect(url.searchParams.get('scope')).toBe('read write');
    expect(url.searchParams.get('state')).toBe('encoded-state');
  });

  it('returns null when the auth config is missing a client id', () => {
    const result = buildToolsetAuthorizeUrl(
      {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        authorizationEndpoint: 'https://auth.example.com/authorize',
      },
      'http://localhost/auth/toolset-signin',
      'encoded-state',
    );

    expect(result).toBeNull();
  });
});

describe('isToolsetAuthValid', () => {
  it('requires both API key header and value for API-key login', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: '',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: 'secret',
      }),
    ).toBe(true);
  });

  it('requires only the API key header for API-key without login', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithoutLogin,
        isLoggedIn: false,
        keyHeader: '',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithoutLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: '',
      }),
    ).toBe(true);
  });

  it('rejects invalid OAuth endpoint URLs when configured OAuth is selected, but allows them to be omitted', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    ).toBe(true);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        authorizationEndpoint: 'not a url',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(true);
  });

  it('requires a client secret for configured OAuth when creating a toolset', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: '',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(false);
  });

  it('does not require a client secret for configured OAuth when editing an existing toolset (the server redacts and preserves it)', () => {
    expect(
      isToolsetAuthValid(
        {
          authenticationType: ToolsetAuthTypes.OAuth,
          withLogin: WithLogin.WithConfig,
          isLoggedIn: false,
          clientId: 'client-id',
          clientSecret: '',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
        },
        true,
      ),
    ).toBe(true);
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

describe('initiateOAuthLogin', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open');
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('returns InvalidConfig without opening a popup when the auth config is invalid', () => {
    const result = initiateOAuthLogin(
      {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
      },
      'toolsets/b/my-toolset__1',
    );

    expect(result.type).toBe(ToolsetOAuthInitiationResultType.InvalidConfig);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it.each([`${'java'}script:alert(1)`, 'data:text/html,unsafe'])(
    'rejects the non-HTTP(S) authorization endpoint %s',
    (authorizationEndpoint) => {
      const result = initiateOAuthLogin(
        { ...validOAuthConfig, authorizationEndpoint },
        'toolsets/b/my-toolset__1',
      );

      expect(result.type).toBe(ToolsetOAuthInitiationResultType.InvalidConfig);
      expect(openSpy).not.toHaveBeenCalled();
    },
  );

  it('returns Blocked when the browser blocks the popup', () => {
    openSpy.mockReturnValue(null);

    const result = initiateOAuthLogin(
      validOAuthConfig,
      'toolsets/b/my-toolset__1',
    );

    expect(result.type).toBe(ToolsetOAuthInitiationResultType.Blocked);
  });

  it('opens a same-origin popup synchronously, writes redirect state into it, and navigates it to the authorize URL', () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValue(popup as unknown as Window);

    const result = initiateOAuthLogin(
      validOAuthConfig,
      'toolsets/b/my-toolset__1',
      ToolsetCredentialsLevel.Global,
    );

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(result.type).toBe(ToolsetOAuthInitiationResultType.Started);
    if (result.type !== ToolsetOAuthInitiationResultType.Started) return;

    expect(result.popup).toBe(popup);
    expect(typeof result.flowId).toBe('string');

    const stored = JSON.parse(
      popup.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
    );
    expect(stored).toMatchObject({
      toolsetId: 'toolsets/b/my-toolset__1',
      credentialsLevel: ToolsetCredentialsLevel.Global,
      state: result.flowId,
    });
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toContain('https://auth.example.com/authorize');
    expect(popup.location.href).toContain(`state=${result.flowId}`);
  });
});

describe('openToolsetOAuthPopup / navigateToolsetOAuthPopup', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open');
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('openToolsetOAuthPopup opens a blank same-origin popup', () => {
    const popup = makeFakePopup();
    openSpy.mockReturnValue(popup as unknown as Window);

    const result = openToolsetOAuthPopup();

    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(result).toBe(popup);
  });

  it('openToolsetOAuthPopup returns null when the browser blocks the popup', () => {
    openSpy.mockReturnValue(null);
    expect(openToolsetOAuthPopup()).toBeNull();
  });

  it('navigateToolsetOAuthPopup closes the popup and returns InvalidConfig when the auth config is invalid', () => {
    const popup = makeFakePopup();

    const result = navigateToolsetOAuthPopup(
      popup as unknown as Window,
      {
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
      },
      'toolsets/b/my-toolset__1',
    );

    expect(result.type).toBe(ToolsetOAuthInitiationResultType.InvalidConfig);
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('navigateToolsetOAuthPopup writes redirect state into the given popup and navigates it', () => {
    const popup = makeFakePopup();

    const result = navigateToolsetOAuthPopup(
      popup as unknown as Window,
      validOAuthConfig,
      'toolsets/b/my-toolset__1',
    );

    expect(result.type).toBe(ToolsetOAuthInitiationResultType.Started);
    if (result.type !== ToolsetOAuthInitiationResultType.Started) return;

    expect(result.popup).toBe(popup);
    const stored = JSON.parse(
      popup.sessionStorage.getItem('toolset-redirect-state') ?? '{}',
    );
    expect(stored).toMatchObject({
      toolsetId: 'toolsets/b/my-toolset__1',
      credentialsLevel: ToolsetCredentialsLevel.User,
      state: result.flowId,
    });
    expect(popup.opener).toBeNull();
    expect(popup.location.href).toContain('https://auth.example.com/authorize');
  });
});

describe('waitForToolsetOAuthResult', () => {
  const flowId = 'flow-123';

  const postMessage = (message: unknown) => {
    const channel = new BroadcastChannel(getToolsetOAuthChannelName(flowId));
    channel.postMessage(message);
    channel.close();
  };

  it('resolves with the success message posted on the flow channel', async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const resultPromise = waitForToolsetOAuthResult(popup, flowId);

    postMessage({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'toolsets/b/my-toolset__1',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'toolsets/b/my-toolset__1',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });
  });

  it('resolves with the failure message posted on the flow channel', async () => {
    const popup = { closed: false, close: vi.fn() } as unknown as Window;
    const resultPromise = waitForToolsetOAuthResult(popup, flowId);

    postMessage({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Failure,
      reason: ToolsetOAuthFailureReason.StateMismatch,
    });
  });

  it('closes the popup itself as soon as a result message arrives', async () => {
    const close = vi.fn();
    const popup = { closed: false, close } as unknown as Window;
    const resultPromise = waitForToolsetOAuthResult(popup, flowId);

    postMessage({
      type: ToolsetOAuthResultType.Success,
      toolsetId: 'toolsets/b/my-toolset__1',
      credentialsLevel: ToolsetCredentialsLevel.User,
    });

    await resultPromise;
    expect(close).toHaveBeenCalledOnce();
  });

  it('resolves as Cancelled when the popup is closed manually', async () => {
    const popup = { closed: false } as { closed: boolean };
    const resultPromise = waitForToolsetOAuthResult(
      popup as unknown as Window,
      flowId,
      {
        pollIntervalMs: 5,
        timeoutMs: 10_000,
      },
    );

    popup.closed = true;

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Cancelled,
    });
  });

  it('resolves as Cancelled when the pending timeout elapses with no result', async () => {
    const close = vi.fn();
    const popup = { closed: false, close } as unknown as Window;

    await expect(
      waitForToolsetOAuthResult(popup, flowId, {
        pollIntervalMs: 5,
        timeoutMs: 20,
      }),
    ).resolves.toEqual({ type: ToolsetOAuthResultType.Cancelled });
    expect(close).toHaveBeenCalledOnce();
  });

  it('ignores messages posted on a different flow id', async () => {
    const popup = { closed: false, close: vi.fn() } as {
      closed: boolean;
      close: ReturnType<typeof vi.fn>;
    };
    const resultPromise = waitForToolsetOAuthResult(
      popup as unknown as Window,
      flowId,
      {
        pollIntervalMs: 5,
        timeoutMs: 50,
      },
    );

    const otherChannel = new BroadcastChannel(
      getToolsetOAuthChannelName('other-flow'),
    );
    otherChannel.postMessage({ type: ToolsetOAuthResultType.Success });
    otherChannel.close();

    await expect(resultPromise).resolves.toEqual({
      type: ToolsetOAuthResultType.Cancelled,
    });
  });
});
