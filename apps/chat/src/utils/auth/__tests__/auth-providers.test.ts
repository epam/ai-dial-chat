import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { OAuthConfig, TokenEndpointHandler } from 'next-auth/providers';

const {
  mockAuth0Provider,
  mockGetAuthAdditionalParamsExchangeBody,
  mockSetClient,
} = vi.hoisted(() => ({
  mockAuth0Provider: vi.fn(),
  mockGetAuthAdditionalParamsExchangeBody: vi.fn(),
  mockSetClient: vi.fn(),
}));

vi.mock('next-auth/providers/auth0', () => ({
  default: mockAuth0Provider,
}));

vi.mock('../auth-additional-params', () => ({
  getAuthAdditionalParamsExchangeBody: mockGetAuthAdditionalParamsExchangeBody,
}));

vi.mock('../nextauth-client', () => ({
  default: {
    setClient: mockSetClient,
    setProviderMeta: vi.fn(),
  },
}));

vi.mock('@/src/utils/app/common', () => ({
  parseCommaSeparatedList: (val: string | undefined) =>
    val
      ? val
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [],
}));

type TokenEndpointContext = Parameters<
  NonNullable<TokenEndpointHandler['request']>
>[0];

type TokenEndpointRequest = NonNullable<TokenEndpointHandler['request']>;

const fakeTokens = { access_token: 'access-token', id_token: 'id-token' };

const makeContext = (options: { idToken?: boolean }): TokenEndpointContext => {
  const mockCallback = vi.fn().mockResolvedValue(fakeTokens);
  const mockOauthCallback = vi.fn().mockResolvedValue(fakeTokens);

  return {
    client: {
      callback: mockCallback,
      oauthCallback: mockOauthCallback,
    },
    provider: {
      id: 'auth0',
      callbackUrl: 'http://localhost:3000/api/auth/callback/auth0',
      ...(options.idToken ? { idToken: true } : {}),
    },
    params: { code: 'test-code' },
    checks: { state: 'test-state' },
  } as unknown as TokenEndpointContext;
};

describe('auth-providers tokenConfig.request', () => {
  const authEnvSnapshot = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('AUTH_')),
  );

  let tokenRequest: TokenEndpointRequest;
  let configuredAuth0Provider:
    | OAuthConfig<Record<string, unknown>>
    | undefined;

  beforeAll(async () => {
    mockAuth0Provider.mockImplementation((options) => ({
      id: options.id ?? 'auth0',
      type: 'oauth',
      wellKnown: `${options.issuer}/.well-known/openid-configuration`,
      options,
    }));

    Object.keys(process.env)
      .filter((key) => key.startsWith('AUTH_'))
      .forEach((key) => {
        delete process.env[key];
      });

    process.env.AUTH_AUTH0_CLIENT_ID = 'test-client';
    process.env.AUTH_AUTH0_SECRET = 'test-secret';
    process.env.AUTH_AUTH0_HOST = 'https://example.auth0.com/';

    vi.resetModules();
    const { authProviders } = await import('../auth-providers');
    configuredAuth0Provider = authProviders.find(
      (provider): provider is OAuthConfig<Record<string, unknown>> =>
        provider.id === 'auth0' && provider.type === 'oauth',
    );

    const auth0Options = mockAuth0Provider.mock.calls[0]?.[0] as
      | { token?: TokenEndpointHandler }
      | undefined;
    const request = auth0Options?.token?.request;

    if (!request) {
      throw new Error('Expected Auth0Provider to receive token.request');
    }

    tokenRequest = request;
  });

  afterAll(() => {
    Object.keys(process.env)
      .filter((key) => key.startsWith('AUTH_'))
      .forEach((key) => {
        delete process.env[key];
      });
    Object.assign(process.env, authEnvSnapshot);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthAdditionalParamsExchangeBody.mockReturnValue(undefined);
  });

  it('normalizes the discovery URL without changing the exact issuer', () => {
    expect(configuredAuth0Provider?.options?.issuer).toBe(
      'https://example.auth0.com/',
    );
    expect(configuredAuth0Provider?.wellKnown).toBe(
      'https://example.auth0.com/.well-known/openid-configuration',
    );
  });

  it('calls callback without extras when idToken is set and no additional params', async () => {
    const context = makeContext({ idToken: true });
    const mockCallback = context.client.callback as ReturnType<typeof vi.fn>;
    const mockOauthCallback = context.client.oauthCallback as ReturnType<
      typeof vi.fn
    >;

    const result = await tokenRequest(context);

    expect(mockSetClient).toHaveBeenCalledWith(
      context.client,
      context.provider,
    );
    expect(mockCallback).toHaveBeenCalledWith(
      context.provider.callbackUrl,
      context.params,
      context.checks,
      undefined,
    );
    expect(mockOauthCallback).not.toHaveBeenCalled();
    expect(result).toEqual({ tokens: fakeTokens });
  });

  it('calls oauthCallback without extras when idToken is not set and no additional params', async () => {
    const context = makeContext({ idToken: false });
    const mockCallback = context.client.callback as ReturnType<typeof vi.fn>;
    const mockOauthCallback = context.client.oauthCallback as ReturnType<
      typeof vi.fn
    >;

    await tokenRequest(context);

    expect(mockOauthCallback).toHaveBeenCalledWith(
      context.provider.callbackUrl,
      context.params,
      context.checks,
      undefined,
    );
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('passes exchangeBody to callback when idToken is set and additional params exist', async () => {
    mockGetAuthAdditionalParamsExchangeBody.mockReturnValue({
      organization_id: 'org-1',
      tenant_id: 'tenant-1',
    });

    const context = makeContext({ idToken: true });
    const mockCallback = context.client.callback as ReturnType<typeof vi.fn>;

    await tokenRequest(context);

    expect(mockCallback).toHaveBeenCalledWith(
      context.provider.callbackUrl,
      context.params,
      context.checks,
      {
        exchangeBody: {
          organization_id: 'org-1',
          tenant_id: 'tenant-1',
        },
      },
    );
  });

  it('passes exchangeBody to oauthCallback when idToken is not set and additional params exist', async () => {
    mockGetAuthAdditionalParamsExchangeBody.mockReturnValue({
      organization_id: 'org-1',
      tenant_id: 'tenant-1',
    });

    const context = makeContext({ idToken: false });
    const mockOauthCallback = context.client.oauthCallback as ReturnType<
      typeof vi.fn
    >;

    await tokenRequest(context);

    expect(mockOauthCallback).toHaveBeenCalledWith(
      context.provider.callbackUrl,
      context.params,
      context.checks,
      {
        exchangeBody: {
          organization_id: 'org-1',
          tenant_id: 'tenant-1',
        },
      },
    );
  });
});
