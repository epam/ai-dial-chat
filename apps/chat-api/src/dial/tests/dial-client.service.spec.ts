import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACKAGE_VERSION } from '../../common/utils/app-version';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../dial-client.service';

vi.mock('@epam/ai-dial-typescript-sdk', () => ({
  createSDK: vi.fn(() => ({ id: 'sdk-client' })),
}));

const makeConfigService = (chatVersion?: string) =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_API_VERSION') return '2024-10-21';
      if (key === 'CHAT_VERSION') return chatVersion;
      return undefined;
    }),
  }) as unknown as ConfigService<EnvironmentVariables>;

describe('DialClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a single SDK client using DIAL_CORE_URL and the shared Core transport', () => {
    const configService = makeConfigService();

    const service = new DialClientService(configService);

    expect(createSDK).toHaveBeenCalledOnce();
    expect(createSDK).toHaveBeenCalledWith({
      baseUrl: 'http://dial-core',
      fetch: service.fetchCore,
    });
  });

  it('exposes client, baseUrl, dialApiVersion, and the package-based User-Agent', () => {
    const service = new DialClientService(makeConfigService());

    expect(service.client).toEqual({ id: 'sdk-client' });
    expect(service.baseUrl).toBe('http://dial-core');
    expect(service.dialApiVersion).toBe('2024-10-21');
    expect(service.userAgent).toBe(`ai-dial-chat/${PACKAGE_VERSION}`);
  });

  it('defaults dialApiVersion when not configured', () => {
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'DIAL_CORE_URL') return 'http://dial-core';
        return undefined;
      }),
    } as unknown as ConfigService<EnvironmentVariables>;

    const service = new DialClientService(configService);

    expect(service.dialApiVersion).toBe('2024-10-21');
  });

  it('uses CHAT_VERSION in the User-Agent when configured', () => {
    const service = new DialClientService(
      makeConfigService('2026.08.25-a1b2c3d'),
    );

    expect(service.userAgent).toBe('ai-dial-chat/2026.08.25-a1b2c3d');
  });

  it('uses the package version when CHAT_VERSION is blank', () => {
    const service = new DialClientService(makeConfigService('   '));

    expect(service.userAgent).toBe(`ai-dial-chat/${PACKAGE_VERSION}`);
  });

  it('normalizes unsupported User-Agent version characters', () => {
    const service = new DialClientService(
      makeConfigService(' release 2026/08 '),
    );

    expect(service.userAgent).toBe('ai-dial-chat/release-2026-08');
  });

  it('uses unknown when the version has no supported characters', () => {
    const service = new DialClientService(makeConfigService('🎉'));

    expect(service.userAgent).toBe('ai-dial-chat/unknown');
  });

  it('sets the canonical User-Agent while preserving request headers and options', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const service = new DialClientService(makeConfigService('1.2.3'));
    const controller = new AbortController();

    await service.fetchCore('http://dial-core/v1/models', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
        'user-agent': 'custom-client',
      },
      body: '{}',
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(input).toBe('http://dial-core/v1/models');
    expect(init).toMatchObject({
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    });
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token');
    expect(headers.get('User-Agent')).toBe('ai-dial-chat/1.2.3');
    expect([...headers.keys()].filter((name) => name === 'user-agent')).toEqual(
      ['user-agent'],
    );
  });

  it('preserves authentication headers carried by a Request input', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    const service = new DialClientService(makeConfigService('1.2.3'));
    const request = new Request('http://dial-core/v1/bucket', {
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer token',
      },
    });

    await service.fetchCore(request);

    const [input, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(input).toBe(request);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token');
    expect(headers.get('User-Agent')).toBe('ai-dial-chat/1.2.3');
  });
});
