import {
  VersionPublicationStatus,
  type VersionStatusEntryDto,
} from '@epam/ai-dial-chat-api-client';
import { VersionHistoryStatus } from '@epam/ai-dial-publish-panel';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  VersionHistoryFormatters,
  VersionHistoryListingItem,
} from '../../version-history';
import {
  useVersionHistory,
  type UseVersionHistoryParams,
} from '../useVersionHistory';

const ID_1 = 'applications/b1/Design/Review__1.0.0';
const ID_BETA = 'applications/b1/Design/Review__beta-2';
const ID_11 = 'applications/b1/Design/Review__1.1.0';

const item = (
  id: string,
  version: string,
  updatedAt: number,
  overrides: Partial<VersionHistoryListingItem> = {},
): VersionHistoryListingItem => ({
  id,
  versionGroupId: 'Design/Review',
  displayVersion: version,
  updatedAt,
  owner: 'Ivan Petrov',
  isMy: true,
  ...overrides,
});

const items = [
  item(ID_1, '1.0.0', 200),
  item(ID_BETA, 'beta-2', 300),
  item(ID_11, '1.1.0', 100),
  item('applications/b1/Research/Review__1.0.0', '1.0.0', 400, {
    versionGroupId: 'Research/Review',
  }),
  item('applications/b2/Design/Review__9.0.0', '9.0.0', 500, { isMy: false }),
];

const formatters: VersionHistoryFormatters = {
  rootLabel: 'Personal',
  formatDate: (timestamp) => `d${timestamp}`,
  formatPublishedBy: (name) => `Published by ${name}`,
  formatOwner: (name) => `by ${name}`,
};

const statusEntry = (
  id: string,
  status: VersionPublicationStatus,
  overrides: Partial<VersionStatusEntryDto> = {},
): VersionStatusEntryDto => ({
  id,
  version: '',
  status,
  publishedFolders: [],
  ...overrides,
});

const makeClient = (entries: VersionStatusEntryDto[] = []) => ({
  getCatalogVersionStatuses: vi.fn().mockResolvedValue(entries),
});

const renderVersionHistory = (props: Partial<UseVersionHistoryParams> = {}) => {
  const client = props.client ?? makeClient();
  const view = renderHook(
    (current: Partial<UseVersionHistoryParams>) =>
      useVersionHistory({
        items,
        resourceId: ID_1,
        entityType: 'application',
        isEnabled: true,
        client,
        formatters,
        ...current,
      }),
    { initialProps: props },
  );
  return { ...view, client };
};

describe('useVersionHistory', () => {
  it('lists the other versions of the group newest first, without the edited one', async () => {
    const { result } = renderVersionHistory();

    expect(result.current.rows.map((row) => row.version)).toEqual([
      'beta-2',
      '1.1.0',
    ]);
    expect(result.current.rows.map((row) => row.id)).not.toContain(ID_1);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('excludes versions saved to other folders and resources that are not the user own', async () => {
    const { result } = renderVersionHistory();

    expect(result.current.rows.map((row) => row.id)).not.toContain(
      'applications/b1/Research/Review__1.0.0',
    );
    expect(result.current.rows.map((row) => row.id)).not.toContain(
      'applications/b2/Design/Review__9.0.0',
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('shows every version of the group even when the listing carries other interfaces or fields', async () => {
    const filtered = items.filter((candidate) => candidate.id !== ID_11);
    const { result } = renderVersionHistory({
      items: [...filtered, { ...item(ID_11, '1.1.0', 100), owner: undefined }],
    });

    expect(result.current.rows).toHaveLength(2);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('keeps a shared resource of another owner out of the list of an own resource that shares its versionGroupId', async () => {
    const own = item('applications/me/Folder/App__2', '2', 200, {
      versionGroupId: 'Folder/App',
    });
    const shared = item('applications/other/Folder/App__1', '1', 100, {
      versionGroupId: 'Folder/App',
      isMy: false,
    });
    const { result } = renderVersionHistory({
      items: [own, shared],
      resourceId: own.id,
    });

    expect(result.current.rows).toEqual([]);
    expect(result.current.hasVersions).toBe(false);
  });

  it('formats the folder with the host root label and the date through the host formatter', async () => {
    const { result } = renderVersionHistory();

    expect(result.current.rows[0]).toMatchObject({
      folder: 'Personal / Design',
      modifiedAt: 'd300',
      author: 'by Ivan Petrov',
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('uses the publisher as the author of a published version and the owner of the others', async () => {
    const client = makeClient([
      statusEntry(ID_BETA, VersionPublicationStatus.Published, {
        publishedFolders: ['Organization/Design'],
        publishedBy: 'Jane Doe',
      }),
      statusEntry(ID_11, VersionPublicationStatus.InReview),
    ]);
    const { result } = renderVersionHistory({ client });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const byId = Object.fromEntries(
      result.current.rows.map((row) => [row.id, row]),
    );
    expect(byId[ID_BETA]).toMatchObject({
      status: VersionHistoryStatus.Published,
      publishedFolders: ['Organization/Design'],
      author: 'Published by Jane Doe',
    });
    expect(byId[ID_11]).toMatchObject({
      status: VersionHistoryStatus.InReview,
      author: 'by Ivan Petrov',
    });
  });

  it('renders the rows at once and loads the statuses in the background', async () => {
    const { result, client } = renderVersionHistory();

    expect(result.current.rows).toHaveLength(2);
    expect(result.current.rows.every((row) => row.status === undefined)).toBe(
      true,
    );
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(client.getCatalogVersionStatuses).toHaveBeenCalledWith(
      'application',
      ID_1,
    );
  });

  it('keeps the unknown status as unknown, never as not published', async () => {
    const client = makeClient([
      statusEntry(ID_BETA, VersionPublicationStatus.Unknown),
    ]);
    const { result } = renderVersionHistory({ client });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows.find((row) => row.id === ID_BETA)?.status).toBe(
      VersionHistoryStatus.Unknown,
    );
  });

  it('loads nothing while the panel is closed', () => {
    const { client } = renderVersionHistory({ isEnabled: false });

    expect(client.getCatalogVersionStatuses).not.toHaveBeenCalled();
  });

  it('returns no rows and requests nothing for a resource that is not the user own', () => {
    const client = makeClient();
    const { result } = renderVersionHistory({
      client,
      resourceId: 'applications/b2/Design/Review__9.0.0',
    });

    expect(result.current.rows).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(client.getCatalogVersionStatuses).not.toHaveBeenCalled();
  });

  it('keeps the rows on failure, reports the error and recovers on retry', async () => {
    const client = makeClient([
      statusEntry(ID_BETA, VersionPublicationStatus.NotPublished),
    ]);
    client.getCatalogVersionStatuses.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderVersionHistory({ client });

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);

    act(() => result.current.onRetry());

    await waitFor(() => expect(result.current.hasError).toBe(false));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(client.getCatalogVersionStatuses).toHaveBeenCalledTimes(2);
    expect(result.current.rows.find((row) => row.id === ID_BETA)?.status).toBe(
      VersionHistoryStatus.NotPublished,
    );
  });

  it('lists a version that appears in the listing without waiting for another request', async () => {
    const { result, rerender } = renderVersionHistory();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({
      items: [
        ...items,
        item('applications/b1/Design/Review__2.0.0', '2.0.0', 900),
      ],
    });

    expect(result.current.rows[0].version).toBe('2.0.0');
  });

  it('reports no versions for an own listing it has not loaded yet, an unknown id and a resource of another owner', () => {
    expect(renderVersionHistory({ items: [] }).result.current.hasVersions).toBe(
      false,
    );
    expect(
      renderVersionHistory({ resourceId: 'applications/b1/Missing__1' }).result
        .current.hasVersions,
    ).toBe(false);
    expect(
      renderVersionHistory({
        resourceId: 'applications/b2/Design/Review__9.0.0',
      }).result.current.hasVersions,
    ).toBe(false);
  });

  it('reports versions for an own resource in the listing', async () => {
    const { result } = renderVersionHistory();

    expect(result.current.hasVersions).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('ignores the response of a request whose resource changed while it was in flight', async () => {
    const resolvers: ((entries: VersionStatusEntryDto[]) => void)[] = [];
    const client = {
      getCatalogVersionStatuses: vi.fn(
        () =>
          new Promise<VersionStatusEntryDto[]>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    };
    const { result, rerender } = renderVersionHistory({ client });

    rerender({ client, resourceId: ID_BETA });
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () =>
      resolvers[0]([statusEntry(ID_1, VersionPublicationStatus.Published)]),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows.every((row) => row.status === undefined)).toBe(
      true,
    );

    await act(async () =>
      resolvers[1]([statusEntry(ID_11, VersionPublicationStatus.InReview)]),
    );

    expect(result.current.rows.find((row) => row.id === ID_11)?.status).toBe(
      VersionHistoryStatus.InReview,
    );
    expect(
      result.current.rows.find((row) => row.id === ID_1)?.status,
    ).toBeUndefined();
  });

  it('shows the loading state again and drops the old statuses when the panel is reopened after a success', async () => {
    const client = makeClient([
      statusEntry(ID_BETA, VersionPublicationStatus.NotPublished),
    ]);
    const { result, rerender } = renderVersionHistory({ client });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ client, isEnabled: false });
    expect(result.current.isLoading).toBe(false);
    rerender({ client, isEnabled: true });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.rows.every((row) => row.status === undefined)).toBe(
      true,
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(client.getCatalogVersionStatuses).toHaveBeenCalledTimes(2);
    expect(result.current.rows.find((row) => row.id === ID_BETA)?.status).toBe(
      VersionHistoryStatus.NotPublished,
    );
  });

  it('clears the error and shows loading when the panel is reopened after a failure', async () => {
    const client = makeClient([
      statusEntry(ID_1, VersionPublicationStatus.NotPublished),
    ]);
    client.getCatalogVersionStatuses.mockRejectedValueOnce(new Error('boom'));
    const { result, rerender } = renderVersionHistory({ client });
    await waitFor(() => expect(result.current.hasError).toBe(true));

    rerender({ client, isEnabled: false });
    rerender({ client, isEnabled: true });

    expect(result.current.hasError).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasError).toBe(false);
  });

  it('reports the error again when the retry fails too', async () => {
    const client = makeClient();
    client.getCatalogVersionStatuses.mockRejectedValue(new Error('boom'));
    const { result } = renderVersionHistory({ client });
    await waitFor(() => expect(result.current.hasError).toBe(true));

    act(() => result.current.onRetry());

    expect(result.current.hasError).toBe(false);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.rows).toHaveLength(2);
    expect(client.getCatalogVersionStatuses).toHaveBeenCalledTimes(2);
  });

  it('reports no versions and requests nothing when the edited version is the only one', () => {
    const client = makeClient();
    const { result } = renderVersionHistory({
      client,
      items: [item(ID_1, '1.0.0', 200)],
    });

    expect(result.current.rows).toEqual([]);
    expect(result.current.hasVersions).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(client.getCatalogVersionStatuses).not.toHaveBeenCalled();
  });
});
