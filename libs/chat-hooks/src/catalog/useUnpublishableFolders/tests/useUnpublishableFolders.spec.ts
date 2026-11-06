import type { PublishHistoryEntryDto } from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveUnpublishableFolders,
  type UnpublishTarget,
} from '../../unpublishable-folders';
import { useUnpublishableFolders } from '../useUnpublishableFolders';

const OWN_ID = 'projects/bucket-1/Sales';
const PUBLIC_ID = 'projects/public/Data/Sales';

const own: UnpublishTarget = {
  entityType: 'project',
  entityId: OWN_ID,
  isOwner: true,
};
const publicCopy: UnpublishTarget = {
  entityType: 'project',
  entityId: PUBLIC_ID,
  isOwner: false,
};

const historyEntry = (folderPath: string): PublishHistoryEntryDto => ({
  entityId: OWN_ID,
  entityType: 'project' as PublishHistoryEntryDto['entityType'],
  folderPath,
  version: '',
  publishedAt: '2026-11-01T10:00:00Z',
  publishedBy: 'Owner',
  publishCredentials: false,
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const client = {
  getCatalogPublishHistory: vi.fn(),
  getCatalogUnpublishAccess: vi.fn(),
};

describe('resolveUnpublishableFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists an owner's published folders once each, newest first", async () => {
    client.getCatalogPublishHistory.mockResolvedValue([
      historyEntry('Organization/Data'),
      historyEntry('Organization/Data'),
      historyEntry('Organization/Sales'),
    ]);

    await expect(
      resolveUnpublishableFolders(client, own, false),
    ).resolves.toEqual([
      ['Organization', 'Data'],
      ['Organization', 'Sales'],
    ]);
    expect(client.getCatalogPublishHistory).toHaveBeenCalledWith(
      'project',
      OWN_ID,
    );
  });

  it('returns no folders for an unpublished own entity', async () => {
    client.getCatalogPublishHistory.mockResolvedValue([]);

    await expect(
      resolveUnpublishableFolders(client, own, false),
    ).resolves.toEqual([]);
  });

  it("gives an administrator the public copy's folder without a request", async () => {
    await expect(
      resolveUnpublishableFolders(client, publicCopy, true),
    ).resolves.toEqual([['Data']]);
    expect(client.getCatalogUnpublishAccess).not.toHaveBeenCalled();
    expect(client.getCatalogPublishHistory).not.toHaveBeenCalled();
  });

  it("gives the publisher the public copy's folder once access is confirmed", async () => {
    client.getCatalogUnpublishAccess.mockResolvedValue({ canUnpublish: true });

    await expect(
      resolveUnpublishableFolders(client, publicCopy, false),
    ).resolves.toEqual([['Data']]);
    expect(client.getCatalogUnpublishAccess).toHaveBeenCalledWith(
      'project',
      PUBLIC_ID,
    );
  });

  it('gives another user nothing on a public copy', async () => {
    client.getCatalogUnpublishAccess.mockResolvedValue({ canUnpublish: false });

    await expect(
      resolveUnpublishableFolders(client, publicCopy, false),
    ).resolves.toEqual([]);
  });

  it('issues no request for an entity the caller does not own', async () => {
    await expect(
      resolveUnpublishableFolders(
        client,
        {
          entityType: 'project',
          entityId: 'projects/other/Sales',
          isOwner: false,
        },
        false,
      ),
    ).resolves.toEqual([]);
    expect(client.getCatalogPublishHistory).not.toHaveBeenCalled();
    expect(client.getCatalogUnpublishAccess).not.toHaveBeenCalled();
  });

  it('rejects when the lookup fails', async () => {
    client.getCatalogPublishHistory.mockRejectedValue(new Error('down'));

    await expect(
      resolveUnpublishableFolders(client, own, false),
    ).rejects.toThrow('down');
  });
});

describe('useUnpublishableFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderFolders = (target: UnpublishTarget | null, isAdmin = false) =>
    renderHook(
      ({ next, admin }: { next: UnpublishTarget | null; admin: boolean }) =>
        useUnpublishableFolders(client, next, admin),
      { initialProps: { next: target, admin: isAdmin } },
    );

  it('is unresolved until the lookup settles, then reports the folders', async () => {
    client.getCatalogPublishHistory.mockResolvedValue([
      historyEntry('Organization/Data'),
    ]);

    const { result } = renderFolders(own);

    expect(result.current.isResolved).toBe(false);
    expect(result.current.folders).toEqual([]);
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.folders).toEqual([['Organization', 'Data']]);
  });

  it('stays unresolved and issues nothing without a target', () => {
    const { result } = renderFolders(null);

    expect(result.current.isResolved).toBe(false);
    expect(client.getCatalogPublishHistory).not.toHaveBeenCalled();
  });

  it('settles a failed lookup as no folders', async () => {
    client.getCatalogPublishHistory.mockRejectedValue(new Error('down'));

    const { result } = renderFolders(own);

    await waitFor(() => expect(result.current.isResolved).toBe(true));
    expect(result.current.folders).toEqual([]);
  });

  it('drops a response for an entity the host has moved away from', async () => {
    const first = deferred<PublishHistoryEntryDto[]>();
    client.getCatalogPublishHistory
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([]);

    const { result, rerender } = renderFolders(own);
    rerender({
      next: { ...own, entityId: 'projects/bucket-1/Other' },
      admin: false,
    });
    await waitFor(() => expect(result.current.isResolved).toBe(true));
    await act(async () => {
      first.resolve([historyEntry('Organization/Data')]);
      await first.promise;
    });

    expect(result.current.folders).toEqual([]);
  });

  it('keeps the folders when a refresh fails', async () => {
    client.getCatalogPublishHistory.mockResolvedValueOnce([
      historyEntry('Organization/Data'),
    ]);
    const { result } = renderFolders(own);
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    client.getCatalogPublishHistory.mockRejectedValueOnce(new Error('down'));

    await act(async () => {
      result.current.refresh();
    });

    expect(client.getCatalogPublishHistory).toHaveBeenCalledTimes(2);
    expect(result.current.isResolved).toBe(true);
    expect(result.current.folders).toEqual([['Organization', 'Data']]);
  });

  it('keeps the folders shown while a refresh runs', async () => {
    client.getCatalogPublishHistory.mockResolvedValueOnce([
      historyEntry('Organization/Data'),
    ]);
    const { result } = renderFolders(own);
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    const next = deferred<PublishHistoryEntryDto[]>();
    client.getCatalogPublishHistory.mockReturnValueOnce(next.promise);

    act(() => result.current.refresh());

    expect(client.getCatalogPublishHistory).toHaveBeenCalledTimes(2);
    expect(result.current.isResolved).toBe(true);
    expect(result.current.folders).toHaveLength(1);
    await act(async () => {
      next.resolve([]);
      await next.promise;
    });
    expect(result.current.folders).toEqual([]);
  });
});
