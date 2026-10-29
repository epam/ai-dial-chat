import { ForbiddenException, HttpException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import type { UserConfigService } from '../../user-config/user-config.service';
import { ProjectsCreateService } from '../create/projects-create.service';
import type {
  ProjectSnapshot,
  ProjectsSnapshotService,
} from '../snapshot/projects-snapshot.service';
import { ProjectsUpdateService } from '../update/projects-update.service';
import { parseProjectId } from '../utils/project-id.util';

const USER_BUCKET = 'a1b2c3';
const PROJECT = parseProjectId('projects/a1b2c3/marketing/q4')!;
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
  manifest: { description: 'old', instructions: 'old', isMalformed: false },
  hasOversizedManifest: false,
  contextFiles: [
    { name: 'survey.csv', size: 3 },
    { name: 'tickets.csv', size: 3 },
  ],
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
  upload = {
    error: undefined,
    response: { status: 200, headers: new Headers({ etag: '"e2"' }) },
  } as unknown,
  move = { error: undefined, response: { status: 200 } } as unknown,
  metadata = [missing, found] as unknown[],
  pinnedIds = [] as string[],
  onUpload = () => undefined as void,
} = {}) => {
  const metadataQueue = [...metadata];
  const client = {
    uploadProjectFolder: vi.fn(async (..._args: unknown[]) => {
      onUpload();
      return upload;
    }),
    moveResource: vi.fn(async (..._args: unknown[]) => move),
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
  const read = vi.fn(async () => snapshot);
  const service = new ProjectsUpdateService(
    { client } as unknown as DialClientService,
    new ProjectsCreateService(config),
    { read } as unknown as ProjectsSnapshotService,
    userConfig as unknown as UserConfigService,
  );
  return { service, client, userConfig, read };
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
      '"e1"',
      USER_BUCKET,
      'token',
    );

    expect(client.uploadProjectFolder).toHaveBeenCalledOnce();
    expect(client.moveResource).not.toHaveBeenCalled();
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

  it('detects a stale ETag before writing', async () => {
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

  it('maps a concurrent write caught by Core to 409 project-changed', async () => {
    const { service } = makeService({
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
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
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
      '"e1"',
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
      '"e1"',
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
        '"e1"',
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
        '"e1"',
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
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(413);
    expect(body.code).toBe('capacity-exceeded');
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
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
      '"e1"',
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
      '"e1"',
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
        '"e1"',
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
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('name-taken');
  });

  it('still saves a rename when the pin migration fails', async () => {
    const { service, userConfig } = makeService();
    userConfig.replaceProjectPin.mockRejectedValue(new Error('config down'));

    await expect(
      service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"e1"',
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
        '"e1"',
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
      '"e1"',
      USER_BUCKET,
      'token',
    );

    const logged = log.mock.calls
      .map(([message]) => String(message))
      .join('\n');
    expect(logged).toContain('added=1');
    expect(logged).not.toMatch(/Secret|retro|tickets|token|a1b2c3/);
  });
  it('refuses a project outside the caller bucket before any Core call', async () => {
    const { service, read, client } = makeService();

    await expect(
      service.updateProject(
        {
          ...PROJECT,
          id: 'projects/other-bucket/marketing/q4',
          bucket: 'other-bucket',
        },
        { name: 'q4' },
        [],
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(read).not.toHaveBeenCalled();
    expect(client.uploadProjectFolder).not.toHaveBeenCalled();
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
        '"e1"',
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
      '"e1"',
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
        '"e1"',
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
    const { service, client, userConfig } = makeService({
      move: { error: { message: 'down' }, response: { status: 503 } },
    });

    const { status, body } = await errorOf(
      service.updateProject(
        PROJECT,
        { name: 'Q4 launch' },
        [],
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    );

    expect(status).toBe(409);
    expect(body.code).toBe('project-changed');
    expect(client.uploadProjectFolder).toHaveBeenCalledOnce();
    expect(userConfig.replaceProjectPin).not.toHaveBeenCalled();
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
      '"e1"',
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
