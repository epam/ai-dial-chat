import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  VersionHistoryI18nKeys,
} from '../../../constants/translation-keys';
import { getCatalogVersionStatuses } from '../../../server-api/publish.api';
import { useResourceVersionHistory } from '../useResourceVersionHistory';

const deployments = {
  items: [
    {
      id: 'applications/b1/Design/Review__1.0.0',
      versionGroupId: 'Design/Review',
      displayVersion: '1.0.0',
      updatedAt: Date.UTC(2026, 6, 12),
      owner: 'Ivan Petrov',
      isMy: true,
    },
  ],
  toolsets: [
    {
      id: 'toolsets/b1/Search__2.0.0',
      versionGroupId: 'Search',
      displayVersion: '2.0.0',
      updatedAt: Date.UTC(2026, 6, 1),
      isMy: true,
    },
  ],
};

vi.mock('../../../context/DeploymentsContext', () => ({
  useDeployments: () => deployments,
}));
vi.mock('../../../server-api/publish.api', () => {
  const getCatalogVersionStatuses = vi.fn();
  return {
    getCatalogVersionStatuses,
    publishApiClient: { getCatalogVersionStatuses },
  };
});
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params == null ? key : `${key}|${params.name ?? params.folders ?? ''}`,
    i18n: { language: 'en' },
  }),
}));

describe('useResourceVersionHistory', () => {
  beforeEach(() => {
    vi.mocked(getCatalogVersionStatuses).mockReset();
    vi.mocked(getCatalogVersionStatuses).mockResolvedValue([]);
  });

  it('builds the application rows from the loaded deployments with translated text', async () => {
    const { result } = renderHook(() =>
      useResourceVersionHistory(
        'applications/b1/Design/Review__1.0.0',
        CatalogEntityType.Agent,
        true,
      ),
    );

    expect(result.current?.rows[0]).toMatchObject({
      version: '1.0.0',
      isCurrent: true,
      folder: `${CatalogI18nKeys.FolderPersonal} / Design`,
      modifiedAt: '12 Jul 2026',
      author: `${VersionHistoryI18nKeys.Owner}|Ivan Petrov`,
    });
    expect(result.current?.labels?.heading).toBe(
      VersionHistoryI18nKeys.Heading,
    );
    expect(result.current?.labels?.retryLabel).toBe(ButtonsI18nKeys.Retry);
    await waitFor(() => expect(result.current?.isLoading).toBe(false));
  });

  it('reads the toolsets listing for a toolset', async () => {
    const { result } = renderHook(() =>
      useResourceVersionHistory(
        'toolsets/b1/Search__2.0.0',
        CatalogEntityType.Toolset,
        true,
      ),
    );

    expect(result.current?.rows.map((row) => row.version)).toEqual(['2.0.0']);
    await waitFor(() =>
      expect(getCatalogVersionStatuses).toHaveBeenCalledWith(
        'toolset',
        'toolsets/b1/Search__2.0.0',
      ),
    );
  });

  it('returns no section props for an unversioned type and loads nothing', () => {
    const { result } = renderHook(() =>
      useResourceVersionHistory(
        'prompts/b1/Greeting',
        CatalogEntityType.Prompt,
        true,
      ),
    );

    expect(result.current).toBeUndefined();
    expect(getCatalogVersionStatuses).not.toHaveBeenCalled();
  });

  it('loads nothing while the panel is closed', () => {
    renderHook(() =>
      useResourceVersionHistory(
        'applications/b1/Design/Review__1.0.0',
        CatalogEntityType.Agent,
        false,
      ),
    );

    expect(getCatalogVersionStatuses).not.toHaveBeenCalled();
  });

  it('returns no section props for a resource missing from the loaded listing or still loading', () => {
    const { result } = renderHook(() =>
      useResourceVersionHistory(
        'applications/b1/Design/Missing__1.0.0',
        CatalogEntityType.Agent,
        true,
      ),
    );

    expect(result.current).toBeUndefined();
    expect(getCatalogVersionStatuses).not.toHaveBeenCalled();
  });

  it('returns no section props for an item that is not the user own', () => {
    deployments.items.push({
      id: 'applications/other/Design/Shared__1.0.0',
      versionGroupId: 'Design/Shared',
      displayVersion: '1.0.0',
      updatedAt: 1,
      owner: 'Someone',
      isMy: false,
    });

    const { result } = renderHook(() =>
      useResourceVersionHistory(
        'applications/other/Design/Shared__1.0.0',
        CatalogEntityType.Agent,
        true,
      ),
    );
    deployments.items.pop();

    expect(result.current).toBeUndefined();
  });
});
