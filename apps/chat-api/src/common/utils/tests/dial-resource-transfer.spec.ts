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
  getResourceLeaf,
  listDialResourceFolders,
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
  it('builds a nested path from a plain folder and an encoded leaf', () => {
    expect(buildFolderResourcePath('My Folder/Sub', 'agent__1.0.0')).toBe(
      'My%20Folder/Sub/agent__1.0.0',
    );
  });

  it('keeps a root path as the leaf only', () => {
    expect(buildFolderResourcePath('', 'agent__1.0.0')).toBe('agent__1.0.0');
  });

  it('keeps a literal percent in a plain folder name', () => {
    expect(buildFolderResourcePath('test%20folder', 'a')).toBe(
      'test%2520folder/a',
    );
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
