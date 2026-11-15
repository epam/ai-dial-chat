import { ForbiddenException, HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import type { UserConfigService } from '../../user-config/user-config.service';
import { ProjectAccessService } from '../access/project-access.service';
import { PROJECT_WRITE_ATTEMPTS } from '../constants/project-context.constants';
import { ProjectsCreateService } from '../create/projects-create.service';
import type {
  ProjectSnapshot,
  ProjectsSnapshotService,
} from '../snapshot/projects-snapshot.service';
import { ProjectsUpdateService } from '../update/projects-update.service';
import { parseProjectId } from '../utils/project-id.util';

const USER_BUCKET = 'a1b2c3';
const PROJECT = parseProjectId('projects/a1b2c3/marketing/q4')!;
const requireProject = (id: string) => {
  const parsed = parseProjectId(id);
  if (parsed == null) throw new Error(`Invalid project id ${id}`);
  return parsed;
};
const SHARED_PROJECT = requireProject('projects/z9y8x7/research');
const sharedWithMe = (permissions: string[]) => ({
  data: {
    resources: [{ nodeType: 'ITEM', url: SHARED_PROJECT.id, permissions }],
  },
  error: undefined,
  response: { status: 200 },
});
const MIB = 1_048_576;
const config = {
  get: () => undefined,
} as unknown as ConfigService<EnvironmentVariables>;

const csv = (text: string) => ({ buffer: Buffer.from(text) });
const pdf = () => ({ buffer: Buffer.from('%PDF-1.7 body') });

const snapshotOf = (
  extra: Partial<ProjectSnapshot> = {},
  entries: Record<string, string> = {
    'context/tickets.csv': 'a,b',
    'context/survey.csv': 'c,d',
  },
): ProjectSnapshot => ({
  etag: '"e1"',
  contentVersion: '"cv1"',
  manifest: { description: 'old', instructions: 'old', isMalformed: false },
  hasOversizedManifest: false,
  contextFiles: [
    { name: 'survey.csv', size: 3 },
    { name: 'tickets.csv', size: 3 },
  ],
  conversationEntries: [],
  artifactEntries: [],
  otherEntries: [],
  readEntry: vi.fn(async (path: string) => Buffer.from(entries[path] ?? '')),
  ...extra,
});

const missing = {
  data: undefined,
  error: { message: 'missing' },
  response: { status: 404 },
};
const found = {
  data: { nodeType: 'ITEM', etag: '"moved"' },
  error: undefined,
  response: { status: 200 },
};

const makeService = ({
  snapshot = snapshotOf(),
  snapshots = [] as ProjectSnapshot[],
  upload = {
    error: undefined,
    response: { status: 200, headers: new Headers({ etag: '"e2"' }) },
  } as unknown,
  move = { error: undefined, response: { status: 200 } } as unknown,
  metadata = [missing, found] as unknown[],
  pinnedIds = [] as string[],
  onUpload = () => undefined as void,
  shared = sharedWithMe(['READ']) as unknown,
} = {}) => {
  const metadataQueue = [...metadata];
  const client = {
    uploadProjectFolder: vi.fn(async (..._args: unknown[]) => {
      onUpload();
      return upload;
    }),
    moveResource: vi.fn(async (..._args: unknown[]) => move),
    getSharedResources: vi.fn(async (..._args: unknown[]) => shared),
    listProjectMetadata: vi.fn(async (..._args: unknown[]) => {
      const next = metadataQueue.shift() ?? found;
      if (next instanceof Error) throw next;
      return next;
    }),
  };
  const userConfig = {
    replaceProjectPin: vi.fn(async () => undefined),
    getPinnedProjectIds: vi.fn(async () => pinnedIds),
  };
  const readState = { renameProject: vi.fn(async () => undefined) };
  const snapshotQueue = [...snapshots];
  const read = vi.fn(async () => snapshotQueue.shift() ?? snapshot);
  const dialClient = { client } as unknown as DialClientService;
  const service = new ProjectsUpdateService(
    dialClient,
    new ProjectsCreateService(config),
    { read } as unknown as ProjectsSnapshotService,
    userConfig as unknown as UserConfigService,
    readState as never,
    new ProjectAccessService(dialClient),
  );
  return { service, client, userConfig, read, readState };
};

const uploadedParts = (client: ReturnType<typeof makeService>['client']) => {
  const [, , init] = client.uploadProjectFolder.mock.calls[0] as [
    string,
    string,
    { headers: Record<string, string>; body: FormData },
  ];
  return {
    headers: init.headers,
    names: (init.body.getAll('file') as File[]).map((file) => file.name),
    file: (name: string) =>
      (init.body.getAll('file') as File[]).find((file) => file.name === name),
  };
};

const errorOf = async (promise: Promise<unknown>) => {
  const error = (await promise.catch((err: unknown) => err)) as HttpException;
  return {
    status: error.getStatus(),
    body: error.getResponse() as { code?: string },
  };
};

describe('ProjectsUpdateService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a text-only edit in exactly one conditional write', async () => {
    const { service, client } = makeService();

    const result = await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'new', instructions: '## New' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(client.uploadProjectFolder).toHaveBeenCalledOnce();
    expect(client.moveResource).not.toHaveBeenCalled();
    expect(client.getSharedResources).not.toHaveBeenCalled();
    const parts = uploadedParts(client);
    expect(parts.headers['If-Match']).toBe('"e1"');
    expect(parts.names.sort()).toEqual([
      'PROJECT.md',
      'context/survey.csv',
      'context/tickets.csv',
    ]);
    expect(await parts.file('PROJECT.md')?.text()).toContain(
      'description: new',
    );
    expect(await parts.file('context/tickets.csv')?.text()).toBe('a,b');
    expect(result).toEqual({
      id: PROJECT.id,
      name: 'q4',
      bucket: USER_BUCKET,
      path: 'marketing/q4',
      etag: '"e2"',
      isPinned: false,
    });
  });

  it('keeps the stored description when the edit omits it', async () => {
    const { service, client } = makeService();

    await service.updateProject(
      PROJECT,
      { name: 'q4', instructions: '## New' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(await uploadedParts(client).file('PROJECT.md')?.text()).toContain(
      'description: old',
    );
  });

  it('refuses a save without If-Match before reading the project', async () => {
    const { service, read } = makeService();

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4' },
        [],
        undefined,
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(428);
    expect(body.code).toBe('if-match-required');
    expect(read).not.toHaveBeenCalled();
  });

  it('detects a stale contentVersion before writing', async () => {
    const { service, client } = makeService();

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4' },
        [],
        '"old"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
  });

  it('gives up with 409 project-changed after the bounded write attempts', async () => {
    const { service, client } = makeService({
      upload: {
        error: { message: 'precondition' },
        response: { status: 412, headers: new Headers() },
      },
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
    expect(client.uploadProjectFolder).toHaveBeenCalledTimes(
      PROJECT_WRITE_ATTEMPTS,
    );
  });

  it('saves when a chat changed the ETag but not the contentVersion', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf({ etag: '"after-chat"' }),
    });

    await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'new' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(uploadedParts(client).headers['If-Match']).toBe('"after-chat"');
  });

  it('re-uploads stored conversations as JSON', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf(
        {
          conversationEntries: [{ name: 'gpt-4o__Q4 summary__1b2c', size: 7 }],
        },
        { 'conversations/gpt-4o__Q4 summary__1b2c': '{"a":1}' },
      ),
    });

    await service.updateProject(
      PROJECT,
      { name: 'q4' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const file = uploadedParts(client).file(
      'conversations/gpt-4o__Q4 summary__1b2c',
    );
    expect(file?.type).toBe('application/json');
    expect(await file?.text()).toBe('{"a":1}');
  });

  it('retries a 412 with the fresh snapshot and its newer conversation bytes', async () => {
    const conversation = 'conversations/gpt-4o__Q4 summary__1b2c';
    const entries = [{ name: 'gpt-4o__Q4 summary__1b2c', size: 1 }];
    let uploads = 0;
    const { service, client } = makeService({
      snapshots: [
        snapshotOf({ conversationEntries: entries }, { [conversation]: 'old' }),
        snapshotOf(
          { etag: '"e2"', conversationEntries: entries },
          { [conversation]: 'newer' },
        ),
      ],
      onUpload: () => {
        uploads += 1;
      },
    });
    client.uploadProjectFolder.mockImplementationOnce(async () => {
      uploads += 1;
      return {
        error: { message: 'precondition' },
        response: { status: 412, headers: new Headers() },
      };
    });

    const result = await service.updateProject(
      PROJECT,
      { name: 'q4' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(uploads).toBe(2);
    const [, , retry] = client.uploadProjectFolder.mock.calls[1] as [
      string,
      string,
      { headers: Record<string, string>; body: FormData },
    ];
    expect(retry.headers['If-Match']).toBe('"e2"');
    const retried = (retry.body.getAll('file') as File[]).find(
      (file) => file.name === conversation,
    );
    expect(await retried?.text()).toBe('newer');
    expect(result.etag).toBe('"e2"');
  });

  it('answers 409 when a real edit landed between the read and the write', async () => {
    const { service, client } = makeService({
      snapshots: [snapshotOf(), snapshotOf({ contentVersion: '"cv2"' })],
      upload: {
        error: { message: 'precondition' },
        response: { status: 412, headers: new Headers() },
      },
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
    expect(client.uploadProjectFolder).toHaveBeenCalledOnce();
  });

  it('adds new files and drops removed ones, uploading only the new bytes', async () => {
    const { service, client } = makeService();

    await service.updateProject(
      PROJECT,
      {
        name: 'q4',
        fileNames: '["retro.pdf"]',
        removedFileNames: '["survey.csv"]',
      },
      [pdf()],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(uploadedParts(client).names.sort()).toEqual([
      'PROJECT.md',
      'context/retro.pdf',
      'context/tickets.csv',
    ]);
  });

  it('replaces a file named in both removedFileNames and fileNames', async () => {
    const { service, client } = makeService();

    await service.updateProject(
      PROJECT,
      {
        name: 'q4',
        fileNames: '["tickets.csv"]',
        removedFileNames: '["tickets.csv"]',
      },
      [csv('new,data')],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const parts = uploadedParts(client);
    expect(
      parts.names.filter((name) => name === 'context/tickets.csv'),
    ).toHaveLength(1);
    expect(await parts.file('context/tickets.csv')?.text()).toBe('new,data');
  });

  it('rejects adding a file whose name a kept file already has', async () => {
    const { service } = makeService();

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4', fileNames: '["tickets.csv"]' },
        [csv('x')],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(400);
    expect(body.code).toBe('duplicate-file-name');
  });

  it('rejects removing a file the project does not have', async () => {
    const { service } = makeService();

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4', removedFileNames: '["missing.csv"]' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(400);
    expect(body.code).toBe('unknown-file');
  });

  it('enforces the capacity against the stored files', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf({
        contextFiles: [{ name: 'big.csv', size: 9.5 * MIB }],
      }),
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4', fileNames: '["more.csv"]' },
        [{ buffer: Buffer.alloc(MIB - 1, 'a') }],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(413);
    expect(body.code).toBe('capacity-exceeded');
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
  });

  it('keeps every stored artifact with the content type of its extension', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf(
        {
          artifactEntries: [
            'artifacts/raw.unknownext',
            'artifacts/report.pdf',
            'artifacts/run-1/deck.pptx',
            'artifacts/script.ts',
          ],
        },
        {
          'context/tickets.csv': 'a',
          'context/survey.csv': 'b',
          'artifacts/raw.unknownext': 'raw',
          'artifacts/report.pdf': '%PDF',
          'artifacts/run-1/deck.pptx': 'deck',
          'artifacts/script.ts': 'export {};',
        },
      ),
    });

    await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'new' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const parts = uploadedParts(client);
    expect(parts.names.sort()).toEqual([
      'PROJECT.md',
      'artifacts/raw.unknownext',
      'artifacts/report.pdf',
      'artifacts/run-1/deck.pptx',
      'artifacts/script.ts',
      'context/survey.csv',
      'context/tickets.csv',
    ]);
    expect(await parts.file('artifacts/report.pdf')?.text()).toBe('%PDF');
    expect(parts.file('artifacts/report.pdf')?.type).toBe('application/pdf');
    expect(parts.file('artifacts/run-1/deck.pptx')?.type).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect(parts.file('artifacts/raw.unknownext')?.type).toBe(
      'application/octet-stream',
    );
    expect(parts.file('artifacts/script.ts')?.type).toBe('text/typescript');
  });

  it('saves when an agent wrote an artifact after the edit page loaded', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf(
        {
          etag: '"after-artifact"',
          artifactEntries: ['artifacts/report.pdf'],
        },
        {
          'context/tickets.csv': 'a',
          'context/survey.csv': 'b',
          'artifacts/report.pdf': '%PDF',
        },
      ),
    });

    const result = await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'new' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const parts = uploadedParts(client);
    expect(parts.headers['If-Match']).toBe('"after-artifact"');
    expect(await parts.file('artifacts/report.pdf')?.text()).toBe('%PDF');
    expect(result.etag).toBe('"e2"');
  });

  it('retries a 412 caused by a new artifact and carries it into the write', async () => {
    const { service, client } = makeService({
      snapshots: [
        snapshotOf(),
        snapshotOf(
          { etag: '"e2"', artifactEntries: ['artifacts/summary.md'] },
          {
            'context/tickets.csv': 'a,b',
            'context/survey.csv': 'c,d',
            'artifacts/summary.md': '# Summary',
          },
        ),
      ],
    });
    client.uploadProjectFolder.mockImplementationOnce(async () => ({
      error: { message: 'precondition' },
      response: { status: 412, headers: new Headers() },
    }));

    await service.updateProject(
      PROJECT,
      { name: 'q4' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(client.uploadProjectFolder).toHaveBeenCalledTimes(2);
    const [, , retry] = client.uploadProjectFolder.mock.calls[1] as [
      string,
      string,
      { headers: Record<string, string>; body: FormData },
    ];
    expect(retry.headers['If-Match']).toBe('"e2"');
    const artifact = (retry.body.getAll('file') as File[]).find(
      (file) => file.name === 'artifacts/summary.md',
    );
    expect(await artifact?.text()).toBe('# Summary');
  });

  it('keeps files another client wrote outside the context folder', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf(
        { otherEntries: ['notes/readme.txt'] },
        {
          'context/tickets.csv': 'a',
          'context/survey.csv': 'b',
          'notes/readme.txt': 'keep me',
        },
      ),
    });

    await service.updateProject(
      PROJECT,
      { name: 'q4' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(await uploadedParts(client).file('notes/readme.txt')?.text()).toBe(
      'keep me',
    );
  });

  it('writes then moves a renamed project and migrates its pin', async () => {
    const { service, client, userConfig } = makeService({
      pinnedIds: ['projects/a1b2c3/marketing/Q4 launch'],
    });

    const result = await service.updateProject(
      PROJECT,
      { name: 'Q4 launch' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(client.uploadProjectFolder.mock.invocationCallOrder[0]).toBeLessThan(
      client.moveResource.mock.invocationCallOrder[0],
    );
    expect(await uploadedParts(client).file('PROJECT.md')?.text()).toContain(
      'name: Q4 launch',
    );
    expect(client.moveResource).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          sourceUrl: 'projects/a1b2c3/marketing/q4',
          destinationUrl: 'projects/a1b2c3/marketing/Q4%20launch',
          overwrite: false,
        },
      }),
    );
    expect(userConfig.replaceProjectPin).toHaveBeenCalledWith(
      PROJECT.id,
      'projects/a1b2c3/marketing/Q4 launch',
      'token',
      USER_BUCKET,
    );
    expect(result).toMatchObject({
      id: 'projects/a1b2c3/marketing/Q4 launch',
      name: 'Q4 launch',
      etag: '"moved"',
      isPinned: true,
    });
  });

  it('refuses a rename onto a taken name without writing', async () => {
    const { service, client } = makeService({ metadata: [found] });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'Handbook' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body).toMatchObject({ code: 'name-taken', field: 'name' });
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
    expect(client.moveResource).not.toHaveBeenCalled();
  });

  it('reports a name taken between the pre-check and the move as name-taken', async () => {
    const { service } = makeService({
      move: { error: { message: 'exists' }, response: { status: 400 } },
      metadata: [missing, found],
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'Handbook' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('name-taken');
  });

  it("re-keys the caller's read state after a rename", async () => {
    const { service, readState } = makeService();

    await service.updateProject(
      PROJECT,
      { name: 'Q4 launch' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(readState.renameProject).toHaveBeenCalledWith(
      PROJECT.id,
      'projects/a1b2c3/marketing/Q4 launch',
      'token',
      USER_BUCKET,
    );
  });

  it('still saves a rename when the read-state migration fails', async () => {
    const { service, readState } = makeService();
    readState.renameProject.mockRejectedValue(new Error('core down'));

    await expect(
      service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    ).resolves.toMatchObject({ id: 'projects/a1b2c3/marketing/Q4 launch' });
  });

  it('still saves a rename when the pin migration fails', async () => {
    const { service, userConfig } = makeService();
    userConfig.replaceProjectPin.mockRejectedValue(new Error('config down'));

    await expect(
      service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    ).resolves.toMatchObject({ id: 'projects/a1b2c3/marketing/Q4 launch' });
  });

  it('rejects an invalid new name before reading the project', async () => {
    const { service, read } = makeService();

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'a/b' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(400);
    expect(body.code).toBe('invalid-name');
    expect(read).not.toHaveBeenCalled();
  });

  it('logs counts and sizes but never names or content', async () => {
    const log = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const { service } = makeService();

    await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'Secret plan', fileNames: '["retro.pdf"]' },
      [pdf()],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const logged = log.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(logged).toContain('added=1');
    expect(logged).not.toMatch(/Secret|retro|tickets|token|a1b2c3/);
  });
  it('refuses a view-only recipient after the permission lookup and before reading the project', async () => {
    const { service, read, client } = makeService();

    await expect(
      service.updateProject(
        SHARED_PROJECT,
        { name: 'research' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.getSharedResources).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
  });

  it('saves a recipient with WRITE into the owner bucket without moving it', async () => {
    const { service, client, read } = makeService({
      shared: sharedWithMe(['READ', 'WRITE']),
    });

    const result = await service.updateProject(
      SHARED_PROJECT,
      { name: 'research', instructions: 'Cite every figure.' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    expect(read).toHaveBeenCalledWith(
      'z9y8x7',
      'research',
      'token',
      USER_BUCKET,
      expect.any(AbortSignal),
    );
    const [bucket] = client.uploadProjectFolder.mock.calls[0] as [string];
    expect(bucket).toBe('z9y8x7');
    expect(client.moveResource).not.toHaveBeenCalled();
    expect(result.id).toBe(SHARED_PROJECT.id);
  });

  it('refuses a rename by a recipient with WRITE before any Core call', async () => {
    const { service, client, read } = makeService({
      shared: sharedWithMe(['READ', 'WRITE']),
    });

    await expect(
      service.updateProject(
        SHARED_PROJECT,
        { name: 'Research 2025' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.getSharedResources).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
  });

  it('refuses an organization project before any Core call', async () => {
    const { service, client, read } = makeService();

    await expect(
      service.updateProject(
        requireProject('projects/public/handbook'),
        { name: 'handbook' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(client.getSharedResources).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it('reports a failed permission lookup as an upstream error, not 403', async () => {
    const { service, read } = makeService({
      shared: {
        data: undefined,
        error: { message: 'down' },
        response: { status: 503 },
      },
    });

    const { status } = await errorOf(
      service.updateProject(
        SHARED_PROJECT,
        { name: 'research' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(502);
    expect(read).not.toHaveBeenCalled();
  });

  it.each(['*', '"e1", "e2"', '  '])(
    'treats If-Match %j as a missing precondition',
    async (ifMatch) => {
      const { service, read } = makeService();

      const { status, body } = await errorOf(
        service.updateProject(
          PROJECT,
          { name: 'q4' },
          [],
          ifMatch,
          USER_BUCKET,
          'token',
        ),
      );

      expect(status).toBe(428);
      expect(body.code).toBe('if-match-required');
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('refuses to overwrite a stored PROJECT.md above the manifest limit', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf({ manifest: null, hasOversizedManifest: true }),
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'q4' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(413);
    expect(body.code).toBe('project-too-large');
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
  });

  it('keeps frontmatter keys another client wrote', async () => {
    const { service, client } = makeService({
      snapshot: snapshotOf({
        manifest: {
          description: 'old',
          instructions: 'old',
          isMalformed: false,
          extraFrontmatter: { owner: 'research', tags: ['q4'] },
        },
      }),
    });

    await service.updateProject(
      PROJECT,
      { name: 'q4', description: 'new' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
    );

    const manifest = await uploadedParts(client).file('PROJECT.md')?.text();
    expect(manifest).toBe(
      '---\nname: q4\ndescription: new\nowner: research\ntags:\n  - q4\n---\n\n',
    );
  });

  it.each([
    [
      'answers an error',
      {
        data: undefined,
        error: { message: 'down' },
        response: { status: 503 },
      },
    ],
    ['rejects', new TypeError('fetch failed')],
  ])(
    'migrates the pin and answers 200 without an ETag when the read-back %s after the move',
    async (_case, readBack) => {
      const { service, userConfig } = makeService({
        metadata: [missing, readBack],
      });

      const result = await service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      );

      expect(userConfig.replaceProjectPin).toHaveBeenCalledOnce();
      expect(result.id).toBe('projects/a1b2c3/marketing/Q4 launch');
      expect(result).not.toHaveProperty('etag');
    },
  );

  it('reports a move that fails with 503 after the write as project-changed', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { service, client, userConfig, readState } = makeService({
      move: { error: { message: 'down' }, response: { status: 503 } },
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"cv1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
    expect(client.uploadProjectFolder).toHaveBeenCalledOnce();
    expect(userConfig.replaceProjectPin).not.toHaveBeenCalled();
    expect(readState.renameProject).not.toHaveBeenCalled();
    const warned = warn.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(warned).toContain('saved under the old name');
    expect(warned).not.toMatch(/Q4 launch|marketing/);
  });

  it('does not abort the move when the client disconnects after the write', async () => {
    const clientRequest = new AbortController();
    const { service, client } = makeService({
      onUpload: () => clientRequest.abort(),
    });

    await service.updateProject(
      PROJECT,
      { name: 'Q4 launch' },
      [],
      '"cv1"',
      USER_BUCKET,
      'token',
      clientRequest.signal,
    );

    const [{ signal }] = client.moveResource.mock.calls[0] as [
      { signal: AbortSignal },
    ];
    expect(signal.aborted).toBe(false);
  });
});
