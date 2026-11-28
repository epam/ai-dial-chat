import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import {
  DialResourceType,
  assertOwnBucket,
  buildFolderResourcePath,
  dialResourceExists,
  existsQuietly,
  getResourceLeaf,
  listDialResourceFolders,
  parseDialResourceUrl,
  resourceExists,
  toDialResourceUrl,
  transferDialResource,
} from '../dial-resource-transfer';

const logger = new Logger('test');
vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

const page = (
  items: { name: string; nodeType: string }[],
  nextToken?: string,
  status = 200,
) => ({
  data: { items, nextToken },
  error: undefined,
  response: { status },
});

const makeClient = (overrides: Record<string, unknown>) =>
  overrides as unknown as DialClientService['client'];

describe('path helpers', () => {
  it.each([
    [
      'builds a nested path from a plain folder and an encoded leaf',
      {
        folder: 'My Folder/Sub',
        leaf: 'agent__1.0.0',
        expected: 'My%20Folder/Sub/agent__1.0.0',
      },
    ],
    [
      'keeps a root path as the leaf only',
      { folder: '', leaf: 'agent__1.0.0', expected: 'agent__1.0.0' },
    ],
    [
      'keeps a literal percent in a plain folder name',
      { folder: 'test%20folder', leaf: 'a', expected: 'test%2520folder/a' },
    ],
  ])('%s', (_name, { folder, leaf, expected }) => {
    expect(buildFolderResourcePath(folder, leaf)).toBe(expected);
  });

  it('returns the last segment as the leaf', () => {
    expect(getResourceLeaf('Design/agent__1.0.0')).toBe('agent__1.0.0');
  });

  it('builds the resource url', () => {
    expect(
      toDialResourceUrl(DialResourceType.Toolsets, {
        bucket: 'b1',
        path: 'Search/search__1.0.0',
      }),
    ).toBe('toolsets/b1/Search/search__1.0.0');
  });

  it('splits a resource url into type, bucket and encoded path, the inverse of toDialResourceUrl', () => {
    const location = { bucket: 'b1', path: 'My%20Folder/agent__1.0.0' };
    const url = toDialResourceUrl(DialResourceType.Applications, location);

    expect(parseDialResourceUrl(url)).toEqual({
      type: 'applications',
      ...location,
    });
  });

  it('rejects a resource outside the session bucket', () => {
    expect(() => assertOwnBucket({ bucket: 'other', path: 'a' }, 'b1')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertOwnBucket({ bucket: 'b1', path: 'a' }, 'b1'),
    ).not.toThrow();
  });
});

describe('listDialResourceFolders', () => {
  it('returns only folders, following every page', async () => {
    const getApplicationMetadata = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [
            { name: 'Design', nodeType: 'FOLDER' },
            { name: 'agent__1.0.0', nodeType: 'ITEM' },
          ],
          'next',
        ),
      )
      .mockResolvedValueOnce(page([{ name: 'Sales', nodeType: 'FOLDER' }]));

    const folders = await listDialResourceFolders(
      makeClient({ getApplicationMetadata }),
      DialResourceType.Applications,
      {},
      'b1',
      '',
      logger,
    );

    expect(folders).toEqual([
      { name: 'Design', path: 'Design' },
      { name: 'Sales', path: 'Sales' },
    ]);
    expect(getApplicationMetadata).toHaveBeenNthCalledWith(1, 'b1', '', {
      headers: {},
      params: { query: { token: undefined } },
    });
    expect(getApplicationMetadata).toHaveBeenNthCalledWith(2, 'b1', '', {
      headers: {},
      params: { query: { token: 'next' } },
    });
  });

  it('lists a nested folder with a trailing slash and relative paths', async () => {
    const getToolSetMetadata = vi
      .fn()
      .mockResolvedValue(page([{ name: 'Audit Agents', nodeType: 'FOLDER' }]));

    const folders = await listDialResourceFolders(
      makeClient({ getToolSetMetadata }),
      DialResourceType.Toolsets,
      {},
      'b1',
      'My Design',
      logger,
    );

    expect(getToolSetMetadata).toHaveBeenCalledWith(
      'b1',
      'My%20Design/',
      expect.anything(),
    );
    expect(folders).toEqual([
      { name: 'Audit Agents', path: 'My Design/Audit Agents' },
    ]);
  });

  it('treats a missing folder as empty', async () => {
    const getApplicationMetadata = vi
      .fn()
      .mockResolvedValue({ error: {}, response: { status: 404 } });

    await expect(
      listDialResourceFolders(
        makeClient({ getApplicationMetadata }),
        DialResourceType.Applications,
        {},
        'b1',
        'Nope',
        logger,
      ),
    ).resolves.toEqual([]);
  });

  it('rejects a repeated page token', async () => {
    const getApplicationMetadata = vi.fn().mockResolvedValue(page([], 'same'));

    await expect(
      listDialResourceFolders(
        makeClient({ getApplicationMetadata }),
        DialResourceType.Applications,
        {},
        'b1',
        '',
        logger,
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('resourceExists', () => {
  const location = { bucket: 'public', path: 'Org/Greeting' };
  const exists = (status: number | undefined) =>
    resourceExists(
      makeClient({
        getPromptMetadata: vi.fn().mockResolvedValue({ response: { status } }),
      }),
      DialResourceType.Prompts,
      location,
      {},
    );

  it('is true when the resource is found', async () => {
    await expect(exists(200)).resolves.toBe(true);
  });

  it('is false only when Core says it is not found', async () => {
    await expect(exists(404)).resolves.toBe(false);
  });

  it.each([401, 403, 500, 503])(
    'throws for status %s instead of reading it as absent',
    async (status) => {
      await expect(exists(status)).rejects.toThrow(/status/);
    },
  );

  it('throws when the request itself fails', async () => {
    await expect(
      resourceExists(
        makeClient({
          getPromptMetadata: vi.fn().mockRejectedValue(new Error('network')),
        }),
        DialResourceType.Prompts,
        location,
        {},
      ),
    ).rejects.toThrow('network');
  });
});

describe('transferDialResource', () => {
  const source = { bucket: 'b1', path: 'agent__1.0.0' };
  const destination = { bucket: 'b1', path: 'Design/agent__1.0.0' };

  it('moves without overwriting', async () => {
    const moveResource = vi
      .fn()
      .mockResolvedValue({ error: undefined, response: { status: 200 } });

    await transferDialResource({
      client: makeClient({ moveResource }),
      operation: 'moveResource',
      type: DialResourceType.Applications,
      headers: { Authorization: 'Bearer t' },
      source,
      destination,
      context: 'move application',
      logger,
    });

    expect(moveResource).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer t' },
      body: {
        sourceUrl: 'applications/b1/agent__1.0.0',
        destinationUrl: 'applications/b1/Design/agent__1.0.0',
        overwrite: false,
      },
    });
  });

  it('reports an existing destination as a conflict', async () => {
    const copyResource = vi
      .fn()
      .mockResolvedValue({ error: {}, response: { status: 400 } });
    const getApplicationMetadata = vi
      .fn()
      .mockResolvedValue({ data: {}, response: { status: 200 } });

    await expect(
      transferDialResource({
        client: makeClient({ copyResource, getApplicationMetadata }),
        operation: 'copyResource',
        type: DialResourceType.Applications,
        headers: {},
        source,
        destination,
        context: 'fork application',
        logger,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws the caller-built conflict when the destination is confirmed to exist', async () => {
    const taken = new ConflictException({ code: 'target-exists' });
    const copyResource = vi
      .fn()
      .mockResolvedValue({ error: {}, response: { status: 400 } });
    const getApplicationMetadata = vi
      .fn()
      .mockResolvedValue({ data: {}, response: { status: 200 } });

    await expect(
      transferDialResource({
        client: makeClient({ copyResource, getApplicationMetadata }),
        operation: 'copyResource',
        type: DialResourceType.Applications,
        headers: {},
        source,
        destination,
        context: 'copy application',
        logger,
        createTargetExistsConflict: () => taken,
      }),
    ).rejects.toBe(taken);
  });

  it('maps other failures to typed HTTP errors', async () => {
    const moveResource = vi
      .fn()
      .mockResolvedValue({ error: {}, response: { status: 404 } });

    await expect(
      transferDialResource({
        client: makeClient({ moveResource }),
        operation: 'moveResource',
        type: DialResourceType.Toolsets,
        headers: {},
        source,
        destination,
        context: 'move toolset',
        logger,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('dialResourceExists', () => {
  const location = { bucket: 'public', path: 'Org/agent__1.0.0' };
  const reader: Record<DialResourceType, string> = {
    [DialResourceType.Applications]: 'getApplicationMetadata',
    [DialResourceType.Toolsets]: 'getToolSetMetadata',
    [DialResourceType.Prompts]: 'getPromptMetadata',
    [DialResourceType.Skills]: 'listSkillMetadata',
    [DialResourceType.Projects]: 'listProjectMetadata',
    [DialResourceType.Files]: 'getFileMetadata',
  };

  it.each(Object.values(DialResourceType))(
    'reads %s metadata: 200 is present, 404 is absent',
    async (type) => {
      const read = vi
        .fn()
        .mockResolvedValueOnce({ data: {}, response: { status: 200 } })
        .mockResolvedValueOnce({ error: {}, response: { status: 404 } });
      const client = makeClient({ [reader[type]]: read });

      await expect(
        dialResourceExists(client, type, location, {}, 'check', logger),
      ).resolves.toBe(true);
      await expect(
        dialResourceExists(client, type, location, {}, 'check', logger),
      ).resolves.toBe(false);
      expect(read.mock.calls[0].slice(0, 2)).toEqual([
        'public',
        'Org/agent__1.0.0',
      ]);
    },
  );

  it.each(Object.values(DialResourceType))(
    'maps another %s status to a typed HTTP error',
    async (type) => {
      const client = makeClient({
        [reader[type]]: vi
          .fn()
          .mockResolvedValue({ error: {}, response: { status: 403 } }),
      });

      await expect(
        dialResourceExists(client, type, location, {}, 'check', logger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('existsQuietly counts a failed read as not found', async () => {
    const client = makeClient({
      getApplicationMetadata: vi
        .fn()
        .mockResolvedValue({ error: {}, response: { status: 500 } }),
    });

    await expect(
      existsQuietly(client, DialResourceType.Applications, location, {}),
    ).resolves.toBe(false);
  });
});

describe('transferDialResource for files', () => {
  const source = { bucket: 'b1', path: 'icons/logo.png' };
  const destination = { bucket: 'public', path: 'Org/Helper__1.0.0/logo.png' };

  it('copies a file without overwriting', async () => {
    const copyResource = vi
      .fn()
      .mockResolvedValue({ error: undefined, response: { status: 200 } });

    await transferDialResource({
      client: makeClient({ copyResource }),
      operation: 'copyResource',
      type: DialResourceType.Files,
      headers: {},
      source,
      destination,
      context: 'copy icon',
      logger,
    });

    expect(copyResource).toHaveBeenCalledWith({
      headers: {},
      body: {
        sourceUrl: 'files/b1/icons/logo.png',
        destinationUrl: 'files/public/Org/Helper__1.0.0/logo.png',
        overwrite: false,
      },
    });
  });

  it('reports an existing file target as a conflict', async () => {
    const copyResource = vi
      .fn()
      .mockResolvedValue({ error: {}, response: { status: 400 } });
    const getFileMetadata = vi
      .fn()
      .mockResolvedValue({ data: {}, response: { status: 200 } });

    await expect(
      transferDialResource({
        client: makeClient({ copyResource, getFileMetadata }),
        operation: 'copyResource',
        type: DialResourceType.Files,
        headers: {},
        source,
        destination,
        context: 'copy icon',
        logger,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(getFileMetadata).toHaveBeenCalledWith('public', destination.path, {
      headers: {},
    });
  });
});
