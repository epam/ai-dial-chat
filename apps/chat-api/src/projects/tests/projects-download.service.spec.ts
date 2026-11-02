import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  buildAttachmentDisposition,
  ProjectsDownloadService,
} from '../download/projects-download.service';
import { parseProjectId } from '../utils/project-id.util';

const USER_BUCKET = 'a1b2c3';
const project = parseProjectId('projects/a1b2c3/marketing/Q4 launch')!;

const okResponse = () => ({
  error: undefined,
  response: {
    status: 200,
    body: new ReadableStream(),
    headers: new Headers({
      'content-type': 'application/zip',
      etag: '"e1"',
      'content-length': '10',
      'set-cookie': 'x=1',
      'content-disposition': 'inline',
    }),
  },
});

const makeService = (result: unknown) => {
  const client = {
    downloadProjectFolder: vi.fn(async (..._args: unknown[]) => result),
    downloadProjectFile: vi.fn(async (..._args: unknown[]) => result),
  };
  return {
    service: new ProjectsDownloadService({
      client,
    } as unknown as DialClientService),
    client,
  };
};

describe('ProjectsDownloadService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('streams the project archive as an attachment named after the project', async () => {
    const { service, client } = makeService(okResponse());

    const download = await service.downloadProject(
      project,
      'token',
      USER_BUCKET,
    );

    expect(client.downloadProjectFolder).toHaveBeenCalledWith(
      USER_BUCKET,
      'marketing/Q4%20launch',
      expect.objectContaining({ parseAs: 'stream' }),
    );
    expect(download.headers).toEqual({
      'content-type': 'application/zip',
      etag: '"e1"',
      'content-disposition':
        'attachment; filename="Q4 launch.zip"; filename*=UTF-8\'\'Q4%20launch.zip',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
  });

  it('streams one context file from the context folder', async () => {
    const { service, client } = makeService(okResponse());

    const download = await service.downloadContextFile(
      project,
      'tickets.csv',
      'token',
      USER_BUCKET,
    );

    expect(client.downloadProjectFile).toHaveBeenCalledWith(
      USER_BUCKET,
      'marketing/Q4%20launch',
      'context/tickets.csv',
      expect.objectContaining({ parseAs: 'stream' }),
    );
    expect(download.headers['content-disposition']).toBe(
      'attachment; filename="tickets.csv"; filename*=UTF-8\'\'tickets.csv',
    );
  });

  it('reports a missing file as not found', async () => {
    const { service } = makeService({
      error: { message: 'missing' },
      response: { status: 404, headers: new Headers() },
    });

    await expect(
      service.downloadContextFile(project, 'x.csv', 'token', USER_BUCKET),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports an empty-bodied 403 in the caller bucket as not found', async () => {
    const { service } = makeService({
      error: undefined,
      response: { status: 403, headers: new Headers() },
    });

    await expect(
      service.downloadProject(project, 'token', USER_BUCKET),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('aborts the Core request when the client disconnects', async () => {
    const { service, client } = makeService(okResponse());

    const download = await service.downloadProject(
      project,
      'token',
      USER_BUCKET,
    );
    const { signal } = client.downloadProjectFolder.mock.calls[0][2] as {
      signal: AbortSignal;
    };
    download.abortOnDisconnect();

    expect(signal.aborted).toBe(true);
  });

  it('stops the deadline once Core answers, so a slow body is not cut off', async () => {
    vi.useFakeTimers();
    try {
      const { service, client } = makeService(okResponse());

      await service.downloadProject(project, 'token', USER_BUCKET);
      const { signal } = client.downloadProjectFolder.mock.calls[0][2] as {
        signal: AbortSignal;
      };
      vi.advanceTimersByTime(10 * 60_000);

      expect(signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('answers 503 when Core sends no response headers in time', async () => {
    vi.useFakeTimers();
    try {
      const client = {
        downloadProjectFolder: vi.fn(
          (...args: unknown[]) =>
            new Promise((_resolve, reject) => {
              const { signal } = args[2] as { signal: AbortSignal };
              signal.addEventListener('abort', () => reject(signal.reason));
            }),
        ),
      };
      const service = new ProjectsDownloadService({
        client,
      } as unknown as DialClientService);

      const download = service
        .downloadProject(project, 'token', USER_BUCKET)
        .catch((err: unknown) => err);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(await download).toBeInstanceOf(ServiceUnavailableException);
    } finally {
      vi.useRealTimers();
    }
  });

  it('encodes a non-ASCII file name per RFC 5987 with an ASCII fallback', () => {
    expect(buildAttachmentDisposition('отчёт "q".csv')).toBe(
      `attachment; filename="_____ _q_.csv"; filename*=UTF-8''${encodeURIComponent('отчёт "q".csv')}`,
    );
  });
});
