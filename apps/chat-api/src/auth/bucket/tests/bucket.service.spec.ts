import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { BucketService } from '../bucket.service';

const TOKEN = 'test-token';

const makeService = (getUserBucket: ReturnType<typeof vi.fn>) => {
  const dialClient = {
    client: { getUserBucket },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;
  return new BucketService(dialClient);
};

describe('BucketService', () => {
  let service: BucketService;
  let getUserBucket: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUserBucket = vi.fn();
    service = makeService(getUserBucket);
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
