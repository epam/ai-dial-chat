import { Logger } from '@nestjs/common';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { custom, Issuer } from 'openid-client';
import { setGlobalDispatcher } from 'undici';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureProxyAgents } from './proxy-agent.setup';

vi.mock('undici', async () => {
  const actual = await vi.importActual<typeof import('undici')>('undici');
  return { ...actual, setGlobalDispatcher: vi.fn() };
});

describe('configureProxyAgents', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    delete Issuer[custom.http_options as never];
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
