import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../../config/environment.config';
import { BucketService } from '../bucket.service';

const TOKEN = 'test-token';

const makeService = () => {
  const configService = {
    get: vi.fn((key: string) => {
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'DIAL_API_VERSION') return '2024-10-21';
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;
  return new BucketService(configService);
};

describe('BucketService', () => {
  let service: BucketService;
  let getUserBucket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = makeService();
    getUserBucket = vi.fn();
    (service as unknown as { client: { getUserBucket: unknown } }).client = {
      getUserBucket,
    };
  });

  it('returns the bucket on success', async () => {
    getUserBucket.mockResolvedValue({
      data: { bucket: 'my-bucket' },
      error: undefined,
      response: { status: 200 },
    });

    const result = await service.getUserBucket(TOKEN);
    expect(result).toEqual({ bucket: 'my-bucket' });
  });

  it('throws NotFoundException from response.status when the error body carries no status', async () => {
    getUserBucket.mockResolvedValue({
      data: undefined,
      error: { message: 'Resource not found' },
      response: { status: 404 },
    });

    await expect(service.getUserBucket(TOKEN)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException from response.status when the error body carries no status', async () => {
    getUserBucket.mockResolvedValue({
      data: undefined,
      error: { message: 'Forbidden' },
      response: { status: 403 },
    });

    await expect(service.getUserBucket(TOKEN)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
