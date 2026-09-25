import https from 'node:https';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { custom, Issuer } from 'openid-client';
import { setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderRegistryService } from '../auth/providers/provider-registry.service';
import { configureProxyAgents } from './proxy-agent.setup';

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return { ...actual, setGlobalDispatcher: vi.fn() };
});

describe('configureProxyAgents', () => {
  beforeEach(() => {
    for (const name of [
      'HTTP_PROXY',
      'HTTPS_PROXY',
      'NO_PROXY',
      'ALL_PROXY',
      'npm_config_proxy',
      'npm_config_http_proxy',
      'npm_config_https_proxy',
      'npm_config_no_proxy',
    ]) {
      vi.stubEnv(name, '');
      vi.stubEnv(name.toLowerCase(), '');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete Issuer[custom.http_options as never];
  });

  describe.each([
    { label: 'through the proxy', proxy: true, noProxy: '' },
    {
      label: 'directly for NO_PROXY hosts',
      proxy: true,
      noProxy: 'login.example.com',
    },
    {
      label: 'directly without proxy configuration',
      proxy: false,
      noProxy: '',
    },
  ])('registered provider requests $label', ({ proxy, noProxy }) => {
    it.each(['callback', 'refresh', 'userinfo', 'revoke', 'jwks'] as const)(
      'routes %s using the configured transport',
      async (operation) => {
        if (proxy) {
          vi.stubEnv('HTTPS_PROXY', 'http://proxy.example.com:8080');
        }
        vi.stubEnv('NO_PROXY', noProxy);
        configureProxyAgents();

        const issuer = new Issuer({
          issuer: 'https://login.example.com',
          token_endpoint: 'https://login.example.com/token',
          userinfo_endpoint: 'https://login.example.com/userinfo',
          revocation_endpoint: 'https://login.example.com/revoke',
          jwks_uri: 'https://login.example.com/jwks',
        });
        vi.spyOn(Issuer, 'discover').mockResolvedValue(issuer);
        const env: Record<string, string> = {
          AUTH_POST_LOGOUT_REDIRECT_URI: 'https://app.example.com',
          AUTH_KEYCLOAK_CLIENT_ID: 'chat-app',
          AUTH_KEYCLOAK_SECRET: 'secret',
          AUTH_KEYCLOAK_HOST: 'login.example.com',
        };
        const module = await Test.createTestingModule({
          providers: [
            ProviderRegistryService,
            {
              provide: ConfigService,
              useValue: { get: (key: string) => env[key] },
            },
          ],
        }).compile();

        /* Exercise real openid-client methods, stopping at the HTTP boundary
         * so no request can reach a live identity provider or proxy. */
        const intercepted = new Error('HTTP request intercepted');
        const requestSpy = vi.spyOn(https, 'request').mockImplementation(() => {
          throw intercepted;
        });
        try {
          await module.init();
          const { client } = module
            .get(ProviderRegistryService)
            .getProvider('keycloak');
          const requests = {
            callback: () =>
              client.callback('https://app.example.com/callback', {
                code: 'code',
              }),
            refresh: () => client.refresh('refresh-token'),
            userinfo: () => client.userinfo('access-token'),
            revoke: () => client.revoke('refresh-token'),
            // v5 exposes this method at runtime but omits its declaration.
            jwks: () =>
              (
                client.issuer as Issuer & {
                  reloadJwksUri(): Promise<void>;
                }
              ).reloadJwksUri(),
          };
          await expect(requests[operation]()).rejects.toThrow(intercepted);
          expect(requestSpy).toHaveBeenCalledOnce();
          const options = requestSpy.mock.calls[0][1] as https.RequestOptions;
          if (proxy && !noProxy) {
            expect(options.agent).toBeInstanceOf(HttpsProxyAgent);
          } else {
            expect(options.agent).toBeUndefined();
          }
          expect(options.timeout).toBe(3500);
          expect(options.headers).toBeDefined();
        } finally {
          await module.close();
        }
      },
    );
  });

  it('does nothing when neither HTTP_PROXY nor HTTPS_PROXY is set', () => {
    configureProxyAgents();

    expect(setGlobalDispatcher).not.toHaveBeenCalled();
    expect(Issuer[custom.http_options as never]).toBeUndefined();
  });

  it('installs a global undici dispatcher and an openid-client http_options hook when HTTPS_PROXY is set', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://proxy.example.com:8080');

    configureProxyAgents();

    expect(setGlobalDispatcher).toHaveBeenCalledOnce();

    const httpOptionsHook = Issuer[custom.http_options as never] as (
      url: URL,
      options: Record<string, unknown>,
    ) => Record<string, unknown>;
    expect(httpOptionsHook).toBeInstanceOf(Function);

    const result = httpOptionsHook(new URL('https://login.example.com/'), {});
    expect(result.agent).toBeInstanceOf(HttpsProxyAgent);
  });

  it('also honors the lowercase http_proxy/https_proxy variants', () => {
    vi.stubEnv('https_proxy', 'http://proxy.example.com:8080');

    configureProxyAgents();

    expect(setGlobalDispatcher).toHaveBeenCalledOnce();
  });

  it('does not attach a proxy agent for a target excluded via NO_PROXY', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://proxy.example.com:8080');
    vi.stubEnv('NO_PROXY', 'login.example.com');

    configureProxyAgents();

    const httpOptionsHook = Issuer[custom.http_options as never] as (
      url: URL,
      options: Record<string, unknown>,
    ) => Record<string, unknown>;

    const result = httpOptionsHook(new URL('https://login.example.com/'), {});
    expect(result.agent).toBeUndefined();
  });

  it('never logs the proxy password', () => {
    vi.stubEnv('HTTPS_PROXY', 'http://user:s3cr3t@proxy.example.com:8080');
    const logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);

    configureProxyAgents();

    const loggedMessages = logSpy.mock.calls.map((call) => String(call[0]));
    expect(loggedMessages.some((message) => message.includes('s3cr3t'))).toBe(
      false,
    );

    logSpy.mockRestore();
  });
});
