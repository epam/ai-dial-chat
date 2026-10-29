import {
  BadGatewayException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import archiver from 'archiver';
import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  PROJECT_ARCHIVE_READ_CONCURRENCY,
  PROJECT_ARCHIVE_READ_MAX_BYTES,
} from '../constants/project-context.constants';
import { ProjectsSnapshotService } from '../snapshot/projects-snapshot.service';
import { buildProjectManifest } from '../utils/project-manifest.util';

const USER_BUCKET = 'a1b2c3';
const SIGNAL = new AbortController().signal;

const buildZip = (entries: Record<string, string | Buffer>): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const [name, content] of Object.entries(entries)) {
      archive.append(
        Buffer.isBuffer(content) ? content : Buffer.from(content),
        {
          name,
        },
      );
    }
    void archive.finalize();
  });

const streamOf = (buffer: Buffer): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });

const archiveResponse = (
  buffer: Buffer,
  headers: Record<string, string> = { etag: '"e1"' },
) => ({
  error: undefined,
  response: {
    status: 200,
    body: streamOf(buffer),
    headers: new Headers(headers),
  },
});

const makeService = (result: unknown) => {
  const downloadProjectFolder = vi.fn(async () => result);
  const service = new ProjectsSnapshotService({
    client: { downloadProjectFolder },
  } as unknown as DialClientService);
  return { service, downloadProjectFolder };
};

const read = (service: ProjectsSnapshotService, bucket = USER_BUCKET) =>
  service.read(bucket, 'marketing/q4', 'token', USER_BUCKET, SIGNAL);

describe('ProjectsSnapshotService', () => {
  it('returns the archive ETag, the parsed manifest and each context file size', async () => {
    const zip = await buildZip({
      'PROJECT.md': buildProjectManifest({
        name: 'q4',
        description: 'About Q4',
        instructions: '## Steps',
      }),
      'context/tickets.csv': Buffer.alloc(2048, 'a'),
      'context/survey.xlsx': Buffer.alloc(10240, 'b'),
    });
    const { service, downloadProjectFolder } = makeService(
      archiveResponse(zip),
    );

    const snapshot = await read(service);

    expect(snapshot.etag).toBe('"e1"');
    expect(snapshot.manifest).toEqual({
      description: 'About Q4',
      instructions: '## Steps',
      isMalformed: false,
    });
    expect(snapshot.contextFiles).toEqual([
      { name: 'survey.xlsx', size: 10240 },
      { name: 'tickets.csv', size: 2048 },
    ]);
    expect(snapshot.otherEntries).toEqual([]);
    expect(downloadProjectFolder).toHaveBeenCalledWith(
      USER_BUCKET,
      'marketing/q4',
      expect.objectContaining({ parseAs: 'stream', signal: SIGNAL }),
    );
  });

  it('inflates an entry on demand', async () => {
    const zip = await buildZip({ 'context/a.csv': 'x,y\n1,2' });
    const { service } = makeService(archiveResponse(zip));

    const snapshot = await read(service);

    expect((await snapshot.readEntry('context/a.csv')).toString()).toBe(
      'x,y\n1,2',
    );
  });

  it('has no manifest when the project has no PROJECT.md', async () => {
    const zip = await buildZip({ 'context/a.csv': 'a' });
    const { service } = makeService(archiveResponse(zip));

    expect((await read(service)).manifest).toBeNull();
  });

  it('keeps nested context paths and other files as other entries', async () => {
    const zip = await buildZip({
      'context/a/b.csv': 'b',
      'notes/readme.txt': 'r',
      'context/top.csv': 't',
    });
    const { service } = makeService(archiveResponse(zip));

    const snapshot = await read(service);

    expect(snapshot.contextFiles).toEqual([{ name: 'top.csv', size: 1 }]);
    expect([...snapshot.otherEntries].sort()).toEqual([
      'context/a/b.csv',
      'notes/readme.txt',
    ]);
  });

  it('ignores a manifest above the manifest limit and flags it', async () => {
    const zip = await buildZip({ 'PROJECT.md': Buffer.alloc(1_048_577, 'a') });
    const { service } = makeService(archiveResponse(zip));

    const snapshot = await read(service);

    expect(snapshot.manifest).toBeNull();
    expect(snapshot.hasOversizedManifest).toBe(true);
  });

  it('does not flag a manifest within the limit', async () => {
    const zip = await buildZip({ 'PROJECT.md': 'x' });
    const { service } = makeService(archiveResponse(zip));

    expect((await read(service)).hasOversizedManifest).toBe(false);
  });

  it('rejects an archive without an ETag as an invalid upstream response', async () => {
    const zip = await buildZip({ 'PROJECT.md': 'x' });
    const { service } = makeService(archiveResponse(zip, {}));

    await expect(read(service)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('refuses an archive whose declared length exceeds the read limit', async () => {
    const zip = await buildZip({ 'PROJECT.md': 'x' });
    const { service } = makeService(
      archiveResponse(zip, {
        etag: '"e1"',
        'content-length': String(PROJECT_ARCHIVE_READ_MAX_BYTES + 1),
      }),
    );

    const error = await read(service).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(PayloadTooLargeException);
    expect((error as PayloadTooLargeException).getResponse()).toMatchObject({
      code: 'project-too-large',
    });
  });

  it('stops buffering once the streamed bytes exceed the read limit', async () => {
    const chunk = new Uint8Array(16 * 1_048_576);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const { service } = makeService({
      error: undefined,
      response: { status: 200, body, headers: new Headers({ etag: '"e1"' }) },
    });

    await expect(read(service)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(sent).toBeLessThanOrEqual(
      PROJECT_ARCHIVE_READ_MAX_BYTES + chunk.byteLength * 2,
    );
  });

  it('rejects an archive with a traversal entry name', async () => {
    const zip = await buildZip({ 'context/../../evil.txt': 'evil' });
    const { service } = makeService(archiveResponse(zip));

    await expect(read(service)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('logs an unreadable archive without the entry name', async () => {
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const zip = await buildZip({ 'secret-plan/../../evil.txt': 'evil' });
    const { service } = makeService(archiveResponse(zip));

    await expect(read(service)).rejects.toBeInstanceOf(BadGatewayException);

    const logged = error.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(logged).toContain('unreadable project archive');
    expect(logged).not.toMatch(/secret-plan|evil/);
    error.mockRestore();
  });

  it('rejects a body that is not a ZIP archive', async () => {
    const { service } = makeService(archiveResponse(Buffer.from('not a zip')));

    await expect(read(service)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('reports a missing project as not found', async () => {
    const { service } = makeService({
      error: { message: 'missing' },
      response: { status: 404, headers: new Headers() },
    });

    await expect(read(service)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a 403 on the caller bucket as not found', async () => {
    const { service } = makeService({
      error: undefined,
      response: { status: 403, headers: new Headers() },
    });

    await expect(read(service)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps a 403 on another bucket as an access denial', async () => {
    const { service } = makeService({
      error: { message: 'denied' },
      response: { status: 403, headers: new Headers() },
    });

    const error = await read(service, 'z9y8x7').catch((err: unknown) => err);

    expect(error).not.toBeInstanceOf(NotFoundException);
    expect((error as { getStatus: () => number }).getStatus()).toBe(403);
  });
});

describe('ProjectsSnapshotService debug logging', () => {
  it('logs the archive entries and sizes at debug level, never file content', async () => {
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const zip = await buildZip({
      'PROJECT.md': buildProjectManifest({
        name: 'q4',
        description: 'Secret plan',
        instructions: 'Hidden steps',
      }),
      'context/tickets.csv': 'confidential,row',
    });
    const { service } = makeService(archiveResponse(zip));

    await read(service);

    const logged = debug.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(logged).toContain('etag="e1"');
    expect(logged).toContain('manifest=parsed');
    expect(logged).toContain('"path":"context/tickets.csv","size":16');
    expect(logged).not.toMatch(/Secret|Hidden|confidential|token/);
    debug.mockRestore();
  });
});

describe('ProjectsSnapshotService concurrency', () => {
  /* Each download hangs until the test releases it. */
  const makeGatedService = async () => {
    const zip = await buildZip({ 'PROJECT.md': 'x' });
    const gates: (() => void)[] = [];
    const downloadProjectFolder = vi.fn(
      () =>
        new Promise((resolve) => {
          gates.push(() => resolve(archiveResponse(zip)));
        }),
    );
    const service = new ProjectsSnapshotService({
      client: { downloadProjectFolder },
    } as unknown as DialClientService);
    return { service, downloadProjectFolder, gates };
  };

  const settle = () => new Promise((resolve) => setImmediate(resolve));

  it('makes reads beyond the limit wait for a free slot', async () => {
    const { service, downloadProjectFolder, gates } = await makeGatedService();

    const reads = Array.from(
      { length: PROJECT_ARCHIVE_READ_CONCURRENCY + 1 },
      () => read(service),
    );
    await settle();
    expect(downloadProjectFolder).toHaveBeenCalledTimes(
      PROJECT_ARCHIVE_READ_CONCURRENCY,
    );

    gates[0]();
    await vi.waitFor(() =>
      expect(downloadProjectFolder).toHaveBeenCalledTimes(
        PROJECT_ARCHIVE_READ_CONCURRENCY + 1,
      ),
    );

    gates.slice(1).forEach((open) => open());
    await expect(Promise.all(reads)).resolves.toHaveLength(
      PROJECT_ARCHIVE_READ_CONCURRENCY + 1,
    );
  });

  it('releases an aborted waiter without reading', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, downloadProjectFolder, gates } = await makeGatedService();
    const reads = Array.from({ length: PROJECT_ARCHIVE_READ_CONCURRENCY }, () =>
      read(service),
    );
    const waiter = new AbortController();
    const waiting = service.read(
      USER_BUCKET,
      'marketing/q4',
      'token',
      USER_BUCKET,
      waiter.signal,
    );
    await settle();

    waiter.abort();

    await expect(waiting).rejects.toBeDefined();
    gates.forEach((open) => open());
    await Promise.all(reads);
    expect(downloadProjectFolder).toHaveBeenCalledTimes(
      PROJECT_ARCHIVE_READ_CONCURRENCY,
    );

    /* The aborted waiter left no slot behind: a full batch still runs at once. */
    const nextBatch = Array.from(
      { length: PROJECT_ARCHIVE_READ_CONCURRENCY },
      () => read(service),
    );
    await settle();
    expect(downloadProjectFolder).toHaveBeenCalledTimes(
      PROJECT_ARCHIVE_READ_CONCURRENCY * 2,
    );
    gates.slice(PROJECT_ARCHIVE_READ_CONCURRENCY).forEach((open) => open());
    await Promise.all(nextBatch);
    vi.restoreAllMocks();
  });
});
