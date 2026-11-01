import {
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import type { DialClientService } from '../../dial/dial-client.service';
import type { UserConfigService } from '../../user-config/user-config.service';
import { ProjectsCreateService } from '../create/projects-create.service';
import { ProjectSource } from '../dto/project-source.enum';
import { ProjectsService } from '../projects.service';
import type {
  ProjectSnapshot,
  ProjectsSnapshotService,
} from '../snapshot/projects-snapshot.service';

const USER_BUCKET = 'a1b2c3';
const config = {
  get: () => undefined,
} as unknown as ConfigService<EnvironmentVariables>;

const snapshotOf = (extra: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  etag: '"e1"',
  contentVersion: '"cv1"',
  manifest: {
    description: 'About Q4',
    instructions: '## Steps',
    isMalformed: false,
  },
  hasOversizedManifest: false,
  contextFiles: [{ name: 'tickets.csv', size: 2048 }],
  conversationEntries: [],
  otherEntries: [],
  readEntry: vi.fn(),
  ...extra,
});

const itemMetadata = {
  data: {
    nodeType: 'ITEM',
    author: 'jane.doe',
    createdAt: 1,
    updatedAt: 2,
  },
  error: undefined,
  response: { status: 200 },
};

const makeService = ({
  metadata = itemMetadata as unknown,
  snapshot = snapshotOf() as ProjectSnapshot | Error,
  read = vi.fn(async (..._args: unknown[]) => {
    if (snapshot instanceof Error) throw snapshot;
    return snapshot;
  }),
} = {}) => {
  const listProjectMetadata = vi.fn(async () => {
    if (metadata instanceof Error) throw metadata;
    return metadata;
  });
  const dialClient = {
    client: { listProjectMetadata },
  } as unknown as DialClientService;
  const service = new ProjectsService(
    dialClient,
    new ProjectsCreateService(config),
    { read } as unknown as ProjectsSnapshotService,
    {} as UserConfigService,
  );
  return { service, listProjectMetadata, read };
};

describe('ProjectsService.getProject', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an editable personal project with its manifest, context and ETag', async () => {
    const { service, listProjectMetadata, read } = makeService();

    const project = await service.getProject(
      'projects/a1b2c3/marketing/q4',
      USER_BUCKET,
      'token',
    );

    expect(project).toEqual({
      id: 'projects/a1b2c3/marketing/q4',
      name: 'q4',
      bucket: USER_BUCKET,
      path: 'marketing/q4',
      parentPath: 'marketing',
      source: ProjectSource.Personal,
      author: 'jane.doe',
      createdAt: 1,
      updatedAt: 2,
      description: 'About Q4',
      instructions: '## Steps',
      contextFiles: [{ name: 'tickets.csv', size: 2048 }],
      etag: '"e1"',
      contentVersion: '"cv1"',
      conversationCount: 0,
      canEdit: true,
    });
    const [, , , , readSignal] = read.mock.calls[0] as unknown as unknown[];
    const [, , metadataInit] = listProjectMetadata.mock.calls[0] as unknown as [
      string,
      string,
      { signal: AbortSignal },
    ];
    expect(metadataInit.signal).toBe(readSignal);
  });

  it('counts the project conversations without returning them', async () => {
    const { service } = makeService({
      snapshot: snapshotOf({
        conversationEntries: [
          { name: 'gpt-4o__A__1', size: 10 },
          { name: 'gpt-4o__B__2', size: 20 },
          { name: 'gpt-4o__C__3', size: 30 },
        ],
      }),
    });

    const project = await service.getProject(
      'projects/a1b2c3/q4',
      USER_BUCKET,
      'token',
    );

    expect(project.conversationCount).toBe(3);
    expect(JSON.stringify(project)).not.toContain('gpt-4o__A__1');
  });

  it('logs the item metadata Core returned at debug level', async () => {
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const { service } = makeService();

    await service.getProject('projects/a1b2c3/q4', USER_BUCKET, 'token');

    const logged = debug.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(logged).toContain('DIAL Core project metadata:');
    expect(logged).toContain('"author":"jane.doe"');
    expect(logged).not.toContain('token');
  });

  it('returns a shared project as read-only', async () => {
    const { service } = makeService();

    const project = await service.getProject(
      'projects/z9y8x7/research',
      USER_BUCKET,
      'token',
    );

    expect(project.source).toBe(ProjectSource.Shared);
    expect(project.canEdit).toBe(false);
  });

  it('returns an organization project as read-only', async () => {
    const { service } = makeService();

    const project = await service.getProject(
      `projects/${PUBLIC_BUCKET}/handbook`,
      USER_BUCKET,
      'token',
    );

    expect(project.source).toBe(ProjectSource.Organization);
    expect(project.canEdit).toBe(false);
  });

  it('falls back to the path name and empty texts without PROJECT.md', async () => {
    const { service } = makeService({
      snapshot: snapshotOf({ manifest: null, contextFiles: [] }),
    });

    const project = await service.getProject(
      'projects/a1b2c3/marketing/q4-launch',
      USER_BUCKET,
      'token',
    );

    expect(project).toMatchObject({
      name: 'q4-launch',
      description: '',
      instructions: '',
      contextFiles: [],
    });
  });

  it('reports a missing project as not found', async () => {
    const { service } = makeService({
      metadata: {
        data: undefined,
        error: { message: 'missing' },
        response: { status: 404 },
      },
    });

    await expect(
      service.getProject('projects/a1b2c3/q4', USER_BUCKET, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a grouping folder as not found', async () => {
    const { service } = makeService({
      metadata: {
        data: { nodeType: 'FOLDER', items: [] },
        error: undefined,
        response: { status: 200 },
      },
    });

    await expect(
      service.getProject('projects/a1b2c3/marketing', USER_BUCKET, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('surfaces an upstream timeout of the archive read', async () => {
    const { service } = makeService({
      snapshot: new ServiceUnavailableException('timeout'),
    });

    await expect(
      service.getProject('projects/a1b2c3/q4', USER_BUCKET, 'token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('aborts the archive read when the metadata read fails', async () => {
    let archiveSignal: AbortSignal | undefined;
    const read = vi.fn(
      (...args: unknown[]) =>
        new Promise<ProjectSnapshot>((_resolve, reject) => {
          archiveSignal = args[4] as AbortSignal;
          archiveSignal.addEventListener('abort', () =>
            reject(archiveSignal?.reason),
          );
        }),
    );
    const { service } = makeService({
      metadata: {
        data: undefined,
        error: { message: 'missing' },
        response: { status: 404 },
      },
      read,
    });

    await expect(
      service.getProject('projects/a1b2c3/q4', USER_BUCKET, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(archiveSignal?.aborted).toBe(true);
  });

  it('ends both reads when the client disconnects', async () => {
    const clientRequest = new AbortController();
    const { service, listProjectMetadata, read } = makeService();

    await service.getProject(
      'projects/a1b2c3/q4',
      USER_BUCKET,
      'token',
      clientRequest.signal,
    );
    const [, , , , readSignal] = read.mock.calls[0] as unknown as [
      unknown,
      unknown,
      unknown,
      unknown,
      AbortSignal,
    ];
    const [, , metadataInit] = listProjectMetadata.mock.calls[0] as unknown as [
      string,
      string,
      { signal: AbortSignal },
    ];
    clientRequest.abort();

    expect(readSignal.aborted).toBe(true);
    expect(metadataInit.signal.aborted).toBe(true);
  });
});
