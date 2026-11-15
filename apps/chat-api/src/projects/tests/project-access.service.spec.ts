import {
  BadGatewayException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectAccessService } from '../access/project-access.service';
import { parseProjectId } from '../utils/project-id.util';

const SESSION_BUCKET = 'a1b2c3';
const ACCESS_TOKEN = 'token';

const project = (id: string) => {
  const parsed = parseProjectId(id);
  if (parsed == null) throw new Error(`bad id ${id}`);
  return parsed;
};

const sharedWith = (url: string, permissions: string[]) => ({
  data: { resources: [{ nodeType: 'ITEM', url, permissions }] },
  error: undefined,
  response: { status: 200 },
});

const makeService = (sharedAnswer: unknown = sharedWith('x', [])) => {
  const client = {
    getSharedResources: vi.fn(async (_init?: unknown) => {
      if (sharedAnswer instanceof Error) throw sharedAnswer;
      return sharedAnswer;
    }),
  };
  const service = new ProjectAccessService({
    client,
  } as unknown as DialClientService);
  return { service, client };
};

describe('ProjectAccessService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('resolveAccess', () => {
    it('gives the owner full access without asking DIAL Core', async () => {
      const { service, client } = makeService();

      await expect(
        service.resolveAccess(
          project('projects/a1b2c3/q4'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).resolves.toEqual({ canEdit: true, canManage: true });
      expect(client.getSharedResources).not.toHaveBeenCalled();
    });

    it('keeps an organization project read-only without asking DIAL Core', async () => {
      const { service, client } = makeService();

      await expect(
        service.resolveAccess(
          project('projects/public/handbook'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).resolves.toEqual({ canEdit: false, canManage: false });
      expect(client.getSharedResources).not.toHaveBeenCalled();
    });

    it('lets a recipient with WRITE edit but not manage', async () => {
      const { service, client } = makeService(
        sharedWith('projects/z9y8x7/research', ['READ', 'WRITE']),
      );
      const request = new AbortController();

      await expect(
        service.resolveAccess(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
          request.signal,
        ),
      ).resolves.toEqual({ canEdit: true, canManage: false });
      expect(client.getSharedResources).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { resourceTypes: ['PROJECT'], with: 'me' },
        }),
      );
      const [init] = client.getSharedResources.mock.calls[0] as unknown as [
        { signal: AbortSignal },
      ];
      request.abort();
      expect(init.signal.aborted).toBe(true);
    });

    it('bounds the lookup with its own deadline when the caller passes no signal', async () => {
      const { service, client } = makeService(
        sharedWith('projects/z9y8x7/research', ['READ', 'WRITE']),
      );

      await service.resolveAccess(
        project('projects/z9y8x7/research'),
        SESSION_BUCKET,
        ACCESS_TOKEN,
      );

      const [init] = client.getSharedResources.mock.calls[0] as unknown as [
        { signal?: AbortSignal },
      ];
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal?.aborted).toBe(false);
    });

    it('keeps a view-only recipient read-only', async () => {
      const { service } = makeService(
        sharedWith('projects/z9y8x7/research', ['READ']),
      );

      await expect(
        service.resolveAccess(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).resolves.toEqual({ canEdit: false, canManage: false });
    });

    it('rejects with the mapped upstream error when DIAL Core fails', async () => {
      const { service } = makeService({
        data: undefined,
        error: { message: 'down' },
        response: { status: 503 },
      });

      await expect(
        service.resolveAccess(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('assertCanWrite', () => {
    it('passes for a recipient with WRITE', async () => {
      const { service } = makeService(
        sharedWith('projects/z9y8x7/research', ['READ', 'WRITE']),
      );

      await expect(
        service.assertCanWrite(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).resolves.toBeUndefined();
    });

    it('refuses a view-only recipient with 403', async () => {
      const { service } = makeService(
        sharedWith('projects/z9y8x7/research', ['READ']),
      );

      await expect(
        service.assertCanWrite(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses an organization project with 403', async () => {
      const { service } = makeService();

      await expect(
        service.assertCanWrite(
          project('projects/public/handbook'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reports an unreachable DIAL Core as 503, not 403', async () => {
      const { service } = makeService(new TypeError('fetch failed'));

      await expect(
        service.assertCanWrite(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('reports a timed-out lookup as 503, not 403', async () => {
      const { service } = makeService(
        new DOMException('The operation timed out', 'TimeoutError'),
      );

      await expect(
        service.assertCanWrite(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
          ACCESS_TOKEN,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('assertCanManage', () => {
    it('passes for the owner', () => {
      const { service } = makeService();

      expect(() =>
        service.assertCanManage(project('projects/a1b2c3/q4'), SESSION_BUCKET),
      ).not.toThrow();
    });

    it('refuses anyone else with 403', () => {
      const { service } = makeService();

      expect(() =>
        service.assertCanManage(
          project('projects/z9y8x7/research'),
          SESSION_BUCKET,
        ),
      ).toThrow(ForbiddenException);
    });
  });
});
