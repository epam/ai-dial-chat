import { createSDK } from '@epam/ai-dial-typescript-sdk';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DialClientService } from '../dial-client.service';

vi.mock('@epam/ai-dial-typescript-sdk', () => ({
  createSDK: vi.fn(() => ({ id: 'sdk-client' })),
}));

const makeConfigService = () =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_API_VERSION') return '2024-10-21';
      return undefined;
    }),
  }) as unknown as ConfigService<EnvironmentVariables>;

describe('DialClientService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a single SDK client using DIAL_CORE_URL', () => {
    const configService = makeConfigService();

    new DialClientService(configService);

    expect(createSDK).toHaveBeenCalledOnce();
    expect(createSDK).toHaveBeenCalledWith({ baseUrl: 'http://dial-core' });
  });

  it('exposes client, baseUrl, and dialApiVersion', () => {
    const service = new DialClientService(makeConfigService());

    expect(service.client).toEqual({ id: 'sdk-client' });
    expect(service.baseUrl).toBe('http://dial-core');
    expect(service.dialApiVersion).toBe('2024-10-21');
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
});
