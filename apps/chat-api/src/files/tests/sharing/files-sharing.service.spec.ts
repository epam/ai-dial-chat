import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { FilesSharingService } from '../../sharing/files-sharing.service';

type SdkClient = {
  revokeSharedResources: ReturnType<typeof vi.fn>;
  discardSharedResources: ReturnType<typeof vi.fn>;
};

function makeService(configOverrides: Record<string, unknown> = {}) {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    revokeSharedResources: vi.fn(),
    discardSharedResources: vi.fn(),
  };

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new FilesSharingService(dialClient, configService);

  return { service, sdkClient };
}

const errResponse = (status: number) => ({
  error: new Error('HTTP error'),
  response: { status, headers: { get: () => null } },
  data: undefined,
});

describe('FilesSharingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('revokeAccess', () => {
    const okRevoke = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    it('returns success=true for an owned, previously-shared resource', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi.fn().mockResolvedValue(okRevoke());

      const result = await service.revokeAccess(
        [{ bucket: 'user-bucket', path: 'reports/q1.pdf' }],
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(sdkClient.revokeSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: {
            resources: [{ url: 'files/user-bucket/reports/q1.pdf' }],
          },
        }),
      );
    });

    it('calls Core once with the full item list for a batch', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi.fn().mockResolvedValue(okRevoke());

      await service.revokeAccess(
        [
          { bucket: 'user-bucket', path: 'a.pdf' },
          { bucket: 'user-bucket', path: 'b.pdf' },
          { bucket: 'user-bucket', path: 'c.pdf' },
          { bucket: 'user-bucket', path: 'd.pdf' },
        ],
        'token',
      );

      expect(sdkClient.revokeSharedResources).toHaveBeenCalledOnce();
      expect(sdkClient.revokeSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            resources: [
              { url: 'files/user-bucket/a.pdf' },
              { url: 'files/user-bucket/b.pdf' },
              { url: 'files/user-bucket/c.pdf' },
              { url: 'files/user-bucket/d.pdf' },
            ],
          },
        }),
      );
    });

    it('throws ForbiddenException when the caller does not own the resource', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(403));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(404));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on an unexpected error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.revokeSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(500));

      await expect(
        service.revokeAccess(
          [{ bucket: 'user-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('discardShared', () => {
    const okDiscard = () => ({
      error: undefined,
      response: { status: 200 },
      data: undefined,
    });

    it('returns success=true for an item shared with the caller', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi.fn().mockResolvedValue(okDiscard());

      const result = await service.discardShared(
        [{ bucket: 'owner-bucket', path: 'shared.pdf' }],
        'token',
      );

      expect(result).toEqual({ success: true });
      expect(sdkClient.discardSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
          body: {
            resources: [{ url: 'files/owner-bucket/shared.pdf' }],
          },
        }),
      );
    });

    it('calls Core once with the full item list for a batch', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi.fn().mockResolvedValue(okDiscard());

      await service.discardShared(
        [
          { bucket: 'owner-bucket', path: 'a.pdf' },
          { bucket: 'owner-bucket', path: 'b.pdf' },
        ],
        'token',
      );

      expect(sdkClient.discardSharedResources).toHaveBeenCalledOnce();
    });

    it('throws ForbiddenException when the resource is not shared with the caller', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(403));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on 404', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(404));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on an unexpected error', async () => {
      const { service, sdkClient } = makeService();
      sdkClient.discardSharedResources = vi
        .fn()
        .mockResolvedValue(errResponse(500));

      await expect(
        service.discardShared(
          [{ bucket: 'owner-bucket', path: 'a.pdf' }],
          'token',
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
