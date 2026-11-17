import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationsService } from '../../applications/applications.service';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ApplicationPublishCopyService,
  STALE_PUBLISH_COPY_AGE_MS,
  ApplicationBeingPublishedException,
} from '../application-publish-copy.service';

const ORIGINAL = { bucket: 'bucket-123', path: 'Design/Helper__1.0.0' };
const COPY_ID = 'applications/bucket-123/Design/.publish-staging/Helper__1.0.0';
const COPY_PATH = 'Design/.publish-staging/Helper__1.0.0';

const ok = { response: { status: 200 } };

const makeService = () => {
  const calls: string[] = [];
  const client = {
    copyResource: vi.fn().mockImplementation(async () => {
      calls.push('copy');
      return ok;
    }),
    deleteCustomApplication: vi.fn().mockImplementation(async () => {
      calls.push('delete');
      return ok;
    }),
    getApplicationMetadata: vi.fn().mockResolvedValue(ok),
  };
  const applications = {
    readApplication: vi.fn().mockImplementation(async () => {
      calls.push('read');
      return { body: { displayName: 'Helper' }, etag: 'etag-1' };
    }),
    writeApplication: vi.fn().mockImplementation(async () => {
      calls.push('write');
    }),
    invalidateAfterWrite: vi.fn().mockResolvedValue(undefined),
  };
  const service = new ApplicationPublishCopyService(
    { client } as unknown as DialClientService,
    applications as unknown as ApplicationsService,
  );
  return { service, client, applications, calls };
};

const existingCopy = (client: ReturnType<typeof makeService>['client']) => {
  client.copyResource
    .mockResolvedValueOnce({ error: {}, response: { status: 400 } })
    .mockResolvedValue(ok);
};

describe('ApplicationPublishCopyService', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('copies to the staging path, then writes the rewritten body with If-Match', async () => {
      const { service, client, applications, calls } = makeService();
      const rewrite = vi
        .fn()
        .mockResolvedValue({ displayName: 'Helper', rewritten: true });

      const copy = await service.create('user-1', 'token', ORIGINAL, rewrite);

      expect(copy).toEqual({
        id: COPY_ID,
        resource: { bucket: 'bucket-123', path: COPY_PATH },
      });
      expect(client.copyResource).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            sourceUrl: 'applications/bucket-123/Design/Helper__1.0.0',
            destinationUrl: COPY_ID,
            overwrite: false,
          },
        }),
      );
      expect(rewrite).toHaveBeenCalledWith({ displayName: 'Helper' });
      expect(applications.writeApplication).toHaveBeenCalledWith(
        expect.anything(),
        { bucket: 'bucket-123', path: COPY_PATH },
        { displayName: 'Helper', rewritten: true },
        expect.any(String),
        'etag-1',
      );
      expect(calls).toEqual(['copy', 'read', 'write']);
      expect(applications.invalidateAfterWrite).toHaveBeenCalledWith(
        'user-1',
        [COPY_ID],
        expect.any(String),
      );
    });

    it('puts the staging folder at the bucket root for a root-level application', async () => {
      const { service } = makeService();

      const copy = await service.create(
        'u',
        'token',
        { bucket: 'b', path: 'App__1' },
        async (body) => body,
      );

      expect(copy.id).toBe('applications/b/.publish-staging/App__1');
    });

    it('answers 409 and leaves a recent copy alone', async () => {
      const { service, client } = makeService();
      existingCopy(client);
      client.getApplicationMetadata.mockResolvedValue({
        data: {
          nodeType: 'ITEM',
          updatedAt: Date.now() - 60 * 1000,
        },
        response: { status: 200 },
      });

      await expect(
        service.create('u', 'token', ORIGINAL, async (body) => body),
      ).rejects.toBeInstanceOf(ApplicationBeingPublishedException);
      expect(client.deleteCustomApplication).not.toHaveBeenCalled();
      expect(client.copyResource).toHaveBeenCalledTimes(1);
    });

    it('reclaims a leftover copy last modified 4 minutes ago', async () => {
      const { service, client, calls } = makeService();
      existingCopy(client);
      client.getApplicationMetadata.mockResolvedValue({
        data: {
          nodeType: 'ITEM',
          updatedAt: Date.now() - 4 * 60 * 1000,
        },
        response: { status: 200 },
      });

      const copy = await service.create(
        'u',
        'token',
        ORIGINAL,
        async (body) => body,
      );

      expect(copy.id).toBe(COPY_ID);
      expect(calls).toEqual(['delete', 'read', 'write']);
      expect(client.copyResource).toHaveBeenCalledTimes(2);
    });

    it('uses the age threshold exactly, with a fake clock', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
      const { service, client } = makeService();
      existingCopy(client);
      client.getApplicationMetadata.mockResolvedValue({
        data: {
          nodeType: 'ITEM',
          updatedAt: Date.now() - STALE_PUBLISH_COPY_AGE_MS,
        },
        response: { status: 200 },
      });

      await expect(
        service.create('u', 'token', ORIGINAL, async (body) => body),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(client.deleteCustomApplication).not.toHaveBeenCalled();
    });

    it('treats a copy whose age cannot be read as current', async () => {
      const { service, client } = makeService();
      existingCopy(client);
      client.getApplicationMetadata.mockResolvedValue({
        data: { nodeType: 'ITEM' },
        response: { status: 200 },
      });

      await expect(
        service.create('u', 'token', ORIGINAL, async (body) => body),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(client.deleteCustomApplication).not.toHaveBeenCalled();
    });

    it('deletes the copy after a failed write and passes a 412 through as the save conflict, not as already publishing', async () => {
      const { service, client, applications } = makeService();
      applications.writeApplication.mockRejectedValue(
        new ConflictException(
          'The application changed while it was being saved',
        ),
      );

      const failure = await service
        .create('u', 'token', ORIGINAL, async (body) => body)
        .catch((err: unknown) => err);

      expect(failure).toBeInstanceOf(ConflictException);
      expect(failure).not.toBeInstanceOf(ApplicationBeingPublishedException);
      expect(client.deleteCustomApplication).toHaveBeenCalledWith(
        'bucket-123',
        COPY_PATH,
        expect.anything(),
      );
    });

    it("passes Core's 403 on the write through and deletes the copy", async () => {
      const { service, client, applications } = makeService();
      const refusal = new ForbiddenException('interceptors');
      applications.writeApplication.mockRejectedValue(refusal);

      await expect(
        service.create('u', 'token', ORIGINAL, async (body) => body),
      ).rejects.toBe(refusal);
      expect(client.deleteCustomApplication).toHaveBeenCalledTimes(1);
    });

    it('deletes the copy when the rewrite itself fails', async () => {
      const { service, client } = makeService();

      await expect(
        service.create('u', 'token', ORIGINAL, async () => {
          throw new Error('schema gone');
        }),
      ).rejects.toThrow('schema gone');
      expect(client.deleteCustomApplication).toHaveBeenCalledTimes(1);
    });

    it('does not delete when Core refuses the copy itself', async () => {
      const { service, client } = makeService();
      client.copyResource.mockResolvedValue({
        error: {},
        response: { status: 403 },
      });

      await expect(
        service.create('u', 'token', ORIGINAL, async (body) => body),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.deleteCustomApplication).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const COPY = {
      id: COPY_ID,
      resource: { bucket: 'bucket-123', path: COPY_PATH },
    };

    it('deletes the copy and clears the cached lists', async () => {
      const { service, client, applications } = makeService();

      await service.delete('user-1', 'token', COPY);

      expect(client.deleteCustomApplication).toHaveBeenCalledWith(
        'bucket-123',
        COPY_PATH,
        expect.anything(),
      );
      expect(applications.invalidateAfterWrite).toHaveBeenCalledWith(
        'user-1',
        [COPY_ID],
        expect.any(String),
      );
    });

    it('logs a warning naming the copy, without the token, when deletion fails', async () => {
      const { service, client } = makeService();
      client.deleteCustomApplication.mockResolvedValue({
        error: {},
        response: { status: 500 },
      });

      await expect(
        service.delete('user-1', 'secret-token', COPY),
      ).resolves.toBeUndefined();

      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain(COPY_ID);
      expect(logged).not.toContain('secret-token');
    });

    it('swallows a thrown deletion error', async () => {
      const { service, client } = makeService();
      client.deleteCustomApplication.mockRejectedValue(new Error('network'));

      await expect(
        service.delete('u', 'secret-token', COPY),
      ).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    });
  });
});
