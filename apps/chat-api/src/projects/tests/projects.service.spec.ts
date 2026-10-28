import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectSource } from '../dto/project-source.enum';
import { ProjectsService } from '../projects.service';

const USER_BUCKET = 'a1b2c3';
const ACCESS_TOKEN = 'access-token';

const project = (bucket: string, name: string, extra = {}) => ({
  nodeType: 'ITEM',
  bucket,
  name,
  ...extra,
});

const ok = (items: unknown[], nextToken?: string) => ({
  data: { nodeType: 'FOLDER', items, nextToken },
  error: undefined,
  response: { status: 200 },
});

const fail = (status: number) => ({
  data: undefined,
  error: { message: 'upstream' },
  response: { status },
});

type PageResult = ReturnType<typeof ok> | ReturnType<typeof fail>;

const makeService = ({
  personal = [ok([])],
  organization = [ok([])],
  shared = { data: { resources: [] }, error: undefined },
}: {
  personal?: Array<PageResult | Error>;
  organization?: Array<PageResult | Error>;
  shared?: unknown;
} = {}) => {
  const pages: Record<string, Array<PageResult | Error>> = {
    [USER_BUCKET]: personal,
    [PUBLIC_BUCKET]: organization,
  };
  const calls: Record<string, number> = {};
  const client = {
    listProjectMetadata: vi.fn(
      async (
        bucket: string,
        _path?: string,
        _init?: {
          params?: { query?: { token?: string } };
          signal?: AbortSignal;
        },
      ) => {
        const index = calls[bucket] ?? 0;
        calls[bucket] = index + 1;
        const queue = pages[bucket];
        const result = queue[Math.min(index, queue.length - 1)];
        if (result instanceof Error) throw result;
        return result;
      },
    ),
    getSharedResources: vi.fn(async (_init?: { signal?: AbortSignal }) => {
      if (shared instanceof Error) throw shared;
      return shared;
    }),
  };
  const dialClient = { client } as unknown as DialClientService;
  return { service: new ProjectsService(dialClient), client };
};

const callsFor = (
  client: ReturnType<typeof makeService>['client'],
  bucket: string,
) => client.listProjectMetadata.mock.calls.filter(([b]) => b === bucket);

describe('ProjectsService', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('merges personal, organization and shared projects with their source', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'a', { updatedAt: 2 })])],
      organization: [ok([project(PUBLIC_BUCKET, 'b')])],
      shared: {
        data: { resources: [{ nodeType: 'ITEM', url: 'projects/z9/c' }] },
        error: undefined,
      },
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(incompleteSources).toEqual([]);
    expect(items.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: `projects/${USER_BUCKET}/a`, source: ProjectSource.Personal },
      { id: `projects/${PUBLIC_BUCKET}/b`, source: ProjectSource.Organization },
      { id: 'projects/z9/c', source: ProjectSource.Shared },
    ]);
    expect(items[0].updatedAt).toBe(2);
  });

  it('sends the bearer token and a recursive root listing for each bucket', async () => {
    const { service, client } = makeService();

    await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    for (const bucket of [USER_BUCKET, PUBLIC_BUCKET]) {
      expect(client.listProjectMetadata).toHaveBeenCalledWith(
        bucket,
        '',
        expect.objectContaining({
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
          params: {
            query: { token: undefined, limit: 1000, recursive: true },
          },
        }),
      );
    }
    expect(client.getSharedResources).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        body: { resourceTypes: ['PROJECT'], with: 'me' },
      }),
    );
  });

  it('shares one deadline signal across every Core call of a listing', async () => {
    const { service, client } = makeService({
      personal: [
        ok([project(USER_BUCKET, 'p1')], 't1'),
        ok([project(USER_BUCKET, 'p2')]),
      ],
    });

    await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    const signals = [
      ...client.listProjectMetadata.mock.calls.map(
        ([, , init]) => init?.signal,
      ),
      client.getSharedResources.mock.calls[0][0]?.signal,
    ];
    expect(signals).toHaveLength(4);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(new Set(signals).size).toBe(1);
  });

  it('drops grouping folders from the recursive listing', async () => {
    const { service } = makeService({
      personal: [
        ok([
          { nodeType: 'FOLDER', bucket: USER_BUCKET, name: 'marketing' },
          project(USER_BUCKET, 'q4', { parentPath: 'marketing/' }),
        ]),
      ],
    });

    const { items } = await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    expect(items.map((item) => item.path)).toEqual(['marketing/q4']);
  });

  it('follows the Core cursor until a page has no nextToken', async () => {
    const { service, client } = makeService({
      personal: [
        ok([project(USER_BUCKET, 'p1')], 't1'),
        ok([project(USER_BUCKET, 'p2')], 't2'),
        ok([project(USER_BUCKET, 'p3')]),
      ],
    });

    const { items } = await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    expect(items.map((item) => item.name)).toEqual(['p1', 'p2', 'p3']);
    const personalCalls = callsFor(client, USER_BUCKET);
    expect(personalCalls).toHaveLength(3);
    expect(personalCalls[1][2]?.params?.query?.token).toBe('t1');
    expect(personalCalls[2][2]?.params?.query?.token).toBe('t2');
  });

  it('stops at the page cap, warns once and returns the collected projects', async () => {
    let page = 0;
    const { service, client } = makeService();
    client.listProjectMetadata.mockImplementation(async (bucket: string) => {
      if (bucket !== USER_BUCKET) return ok([]);
      page += 1;
      return ok([project(USER_BUCKET, `p${page}`)], `t${page}`);
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items).toHaveLength(20);
    expect(incompleteSources).toEqual([ProjectSource.Personal]);
    expect(callsFor(client, USER_BUCKET)).toHaveLength(20);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      'Project listing stopped at the page cap (source=personal, pages=20)',
    );
  });

  it('fails only the source whose cursor repeats', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'mine')])],
      organization: [
        ok([project(PUBLIC_BUCKET, 'o1')], 'same'),
        ok([project(PUBLIC_BUCKET, 'o2')], 'same'),
      ],
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items.map((item) => item.name)).toEqual(['mine']);
    expect(incompleteSources).toEqual([ProjectSource.Organization]);
    expect(warn).toHaveBeenCalledWith(
      'Project listing failed for source=organization',
    );
  });

  it('keeps one entry per id, preferring personal over organization over shared', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'x')])],
      organization: [ok([project(PUBLIC_BUCKET, 'y')])],
      shared: {
        data: {
          resources: [
            { nodeType: 'ITEM', url: `projects/${USER_BUCKET}/x` },
            { nodeType: 'ITEM', url: `projects/${PUBLIC_BUCKET}/y` },
          ],
        },
        error: undefined,
      },
    });

    const { items } = await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    expect(items.map(({ id, source }) => ({ id, source }))).toEqual([
      { id: `projects/${USER_BUCKET}/x`, source: ProjectSource.Personal },
      { id: `projects/${PUBLIC_BUCKET}/y`, source: ProjectSource.Organization },
    ]);
  });

  it('treats a 404 on the bucket root as an empty source', async () => {
    const { service } = makeService({
      personal: [fail(404)],
      organization: [ok([project(PUBLIC_BUCKET, 'o')])],
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items.map((item) => item.name)).toEqual(['o']);
    expect(incompleteSources).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('fails the source on a 404 for a later page', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'p1')], 't1'), fail(404)],
      organization: [ok([project(PUBLIC_BUCKET, 'o')])],
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items.map((item) => item.name)).toEqual(['o']);
    expect(incompleteSources).toEqual([ProjectSource.Personal]);
    expect(warn).toHaveBeenCalledWith(
      'Project listing failed for source=personal',
    );
  });

  it('returns personal and shared projects when the organization listing fails', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'mine')])],
      organization: [fail(500)],
      shared: {
        data: { resources: [{ nodeType: 'ITEM', url: 'projects/z9/s' }] },
        error: undefined,
      },
    });

    const { items } = await service.listProjects(USER_BUCKET, ACCESS_TOKEN);

    expect(items.map((item) => item.source)).toEqual([
      ProjectSource.Personal,
      ProjectSource.Shared,
    ]);
    expect(warn).toHaveBeenCalledWith(
      'Project listing failed for source=organization',
    );
  });

  describe('when both bucket listings fail', () => {
    const timeout = Object.assign(new Error('aborted'), {
      name: 'TimeoutError',
    });

    it.each([
      ['a timeout', timeout, ServiceUnavailableException],
      ['a 500', fail(500), BadGatewayException],
      ['a 403', fail(403), ForbiddenException],
    ])(
      'surfaces the personal listing error for %s',
      async (_label, personal, expected) => {
        const { service } = makeService({
          personal: [personal],
          organization: [fail(500)],
        });

        await expect(
          service.listProjects(USER_BUCKET, ACCESS_TOKEN),
        ).rejects.toBeInstanceOf(expected);
      },
    );

    it('surfaces a 429 as Too Many Requests', async () => {
      const { service } = makeService({
        personal: [fail(429)],
        organization: [fail(500)],
      });

      const error = await service
        .listProjects(USER_BUCKET, ACCESS_TOKEN)
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    });
  });

  it('returns no shared projects when the shared listing returns an error', async () => {
    const { service } = makeService({
      personal: [ok([project(USER_BUCKET, 'mine')])],
      shared: {
        data: undefined,
        error: { message: 'boom' },
        response: { status: 502 },
      },
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items.map((item) => item.source)).toEqual([ProjectSource.Personal]);
    expect(incompleteSources).toEqual([ProjectSource.Shared]);
    expect(warn).toHaveBeenCalledWith(
      'getSharedResources (PROJECT) returned an error (status=502)',
    );
  });

  it('returns no shared projects when the shared listing throws', async () => {
    const { service } = makeService({
      shared: Object.assign(new Error('aborted'), { name: 'TimeoutError' }),
    });

    const { items, incompleteSources } = await service.listProjects(
      USER_BUCKET,
      ACCESS_TOKEN,
    );

    expect(items).toEqual([]);
    expect(incompleteSources).toEqual([ProjectSource.Shared]);
    expect(warn).toHaveBeenCalledWith(
      'getSharedResources (PROJECT) failed (TimeoutError)',
    );
  });
});
