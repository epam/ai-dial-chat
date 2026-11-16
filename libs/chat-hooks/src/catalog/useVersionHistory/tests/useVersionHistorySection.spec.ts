import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  VersionHistoryFormatters,
  VersionHistoryListingItem,
} from '../../version-history';
import {
  useVersionHistorySection,
  type UseVersionHistorySectionParams,
} from '../useVersionHistorySection';

const APP_ID = 'applications/b1/Design/Review__1.0.0';
const APP_OTHER_ID = 'applications/b1/Design/Review__2.0.0';
const TOOLSET_ID = 'toolsets/b1/Design/Search__1.0.0';
const TOOLSET_OTHER_ID = 'toolsets/b1/Design/Search__2.0.0';

const listed = (
  id: string,
  versionGroupId: string,
): VersionHistoryListingItem => ({
  id,
  versionGroupId,
  displayVersion: '1.0.0',
  updatedAt: 100,
  isMy: true,
});

const formatters: VersionHistoryFormatters = {
  rootLabel: 'Personal',
  formatDate: (timestamp) => `d${timestamp}`,
  formatPublishedBy: (name) => `Published by ${name}`,
  formatOwner: (name) => `by ${name}`,
};

const client = { getCatalogVersionStatuses: vi.fn().mockResolvedValue([]) };

const renderSection = (props: Partial<UseVersionHistorySectionParams> = {}) =>
  renderHook(() =>
    useVersionHistorySection({
      resourceId: APP_ID,
      resourceType: CatalogEntityType.Agent,
      isEnabled: true,
      applications: [
        listed(APP_ID, 'Design/Review'),
        listed(APP_OTHER_ID, 'Design/Review'),
      ],
      toolsets: [
        listed(TOOLSET_ID, 'Design/Search'),
        listed(TOOLSET_OTHER_ID, 'Design/Search'),
      ],
      client,
      labels: { heading: 'History' },
      formatters,
      ...props,
    }),
  );

describe('useVersionHistorySection', () => {
  it('returns the other versions of an application from the applications listing', () => {
    const { result } = renderSection();

    expect(result.current?.rows.map((row) => row.id)).toEqual([APP_OTHER_ID]);
    expect(result.current?.labels?.heading).toBe('History');
  });

  it('reads the toolsets listing for a toolset', () => {
    const { result } = renderSection({
      resourceId: TOOLSET_ID,
      resourceType: CatalogEntityType.Toolset,
    });

    expect(result.current?.rows.map((row) => row.id)).toEqual([
      TOOLSET_OTHER_ID,
    ]);
  });

  it('returns nothing for an unversioned resource type', () => {
    const { result } = renderSection({
      resourceType: CatalogEntityType.Prompt,
    });

    expect(result.current).toBeUndefined();
  });

  it('returns nothing while the listing holds no version the user owns', () => {
    const { result } = renderSection({ applications: [] });

    expect(result.current).toBeUndefined();
  });

  it('returns nothing when the open version is the only one', () => {
    const { result } = renderSection({
      applications: [listed(APP_ID, 'Design/Review')],
    });

    expect(result.current).toBeUndefined();
  });

  it('returns nothing for an empty resource id', () => {
    const { result } = renderSection({ resourceId: '', isEnabled: false });

    expect(result.current).toBeUndefined();
  });
});
