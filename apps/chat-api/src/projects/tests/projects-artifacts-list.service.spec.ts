import { BadGatewayException, Logger, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectArtifactsListService } from '../artifacts/projects-artifacts-list.service';
import { parseProjectId } from '../utils/project-id.util';

const PROJECT = parseProjectId('projects/a1b2c3/q4-launch')!;

const listing = (items: unknown[], nextToken?: string) => ({
  data: { items, ...(nextToken ? { nextToken } : {}) },
  error: undefined,
  response: new Response(null, { status: 200 }),
});

const failure = (status: number) => ({
  data: undefined,
  error: { message: 'failed' },
  response: new Response(null, { status }),
});

const file = (name: string, updatedAt?: number, author = 'Jane Doe') => ({
  name,
  nodeType: 'ITEM',
  author,
  ...(updatedAt != null ? { updatedAt } : {}),
});

const makeService = (responses: unknown[]) => {
  const queue = [...responses];
  const client = {
    listProjectFileMetadata: vi.fn(async () => queue.shift()),
  };
  const service = new ProjectArtifactsListService({
    client,
  } as unknown as DialClientService);
  return { service, client };
};

describe('ProjectArtifactsListService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the outputs newest first, then by name', async () => {
    const { service, client } = makeService([
      listing([
        file('report.pdf', 100),
        file('summary.md', 300),
        file('deck.pptx', 200),
        file('b.csv', 50),
        file('a.csv', 50),
      ]),
    ]);

    const result = await service.listArtifacts(PROJECT, 'token', 'a1b2c3');

    expect(result.items.map((item) => item.name)).toEqual([
      'summary.md',
      'deck.pptx',
      'report.pdf',
      'a.csv',
      'b.csv',
    ]);
    expect(result.items[0]).toEqual({
      name: 'summary.md',
      updatedAt: 300,
      author: 'Jane Doe',
    });
    expect(client.listProjectFileMetadata).toHaveBeenCalledWith(
      'a1b2c3',
      'q4-launch',
      'artifacts/',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token' },
        params: { query: { limit: 1000, recursive: false } },
      }),
    );
  });

  it('omits the time and author when Core sends none', async () => {
    const { service } = makeService([
      listing([{ name: 'raw.bin', nodeType: 'ITEM' }]),
    ]);

    const result = await service.listArtifacts(PROJECT, 'token', 'a1b2c3');

    expect(result.items).toEqual([{ name: 'raw.bin' }]);
  });

  it('does not list nested folders', async () => {
    const { service } = makeService([
      listing([file('report.pdf', 1), { name: 'run-1', nodeType: 'FOLDER' }]),
    ]);

    const result = await service.listArtifacts(PROJECT, 'token', 'a1b2c3');

    expect(result.items.map((item) => item.name)).toEqual(['report.pdf']);
  });

  it('lists none when the project has no artifacts folder', async () => {
    const { service } = makeService([failure(404)]);

    await expect(
      service.listArtifacts(PROJECT, 'token', 'a1b2c3'),
    ).resolves.toEqual({ items: [] });
  });

  it("follows Core's pages", async () => {
    const { service, client } = makeService([
      listing([file('a.csv', 1)], 't1'),
      listing([file('b.csv', 2)]),
    ]);

    const result = await service.listArtifacts(PROJECT, 'token', 'a1b2c3');

    expect(client.listProjectFileMetadata).toHaveBeenCalledTimes(2);
    expect(client.listProjectFileMetadata).toHaveBeenLastCalledWith(
      'a1b2c3',
      'q4-launch',
      'artifacts/',
      expect.objectContaining({
        params: { query: { limit: 1000, recursive: false, token: 't1' } },
      }),
    );
    expect(result.items.map((item) => item.name)).toEqual(['b.csv', 'a.csv']);
  });

  it("reports Core's 403 in the caller's own bucket as a missing project", async () => {
    const { service } = makeService([failure(403)]);

    await expect(
      service.listArtifacts(PROJECT, 'token', 'a1b2c3'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps an upstream failure to a gateway error', async () => {
    const { service } = makeService([failure(500)]);

    await expect(
      service.listArtifacts(PROJECT, 'token', 'a1b2c3'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
