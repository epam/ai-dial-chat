import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DeploymentFolderLabels } from '../../map-deployment-to-catalog-item';
import type { SkillOverviewLabels } from '../../map-skill-to-catalog-item';
import type { SkillDetailsApi } from '../../useSkillItemDetails';
import type { UseSkillDetailsPanelDataOptions } from '../useSkillDetailsPanelData';
import { useSkillDetailsPanelData } from '../useSkillDetailsPanelData';

/** A promise plus its externally-callable resolver, for controlling settle order in tests. */
const makeDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const SKILL_A: SkillMetadataItemDto = {
  name: 'skill-a',
  path: 'skill-a',
  url: 'skills/my-bucket/skill-a',
  bucket: 'my-bucket',
  nodeType: 'item',
};

const SKILL_B: SkillMetadataItemDto = {
  name: 'skill-b',
  path: 'skill-b',
  url: 'skills/my-bucket/skill-b',
  bucket: 'my-bucket',
  nodeType: 'item',
};

const folderLabels: DeploymentFolderLabels = {
  personal: 'Personal',
  shared: 'Shared with me',
  public: 'Organization',
};

const skillOverviewLabels: SkillOverviewLabels = {
  whenToUseLabel: 'When to use',
  allowedToolsLabel: 'Allowed tools',
  bundledResourcesLabel: 'Bundled resources',
  specificationSectionTitle: 'Specification',
  authorLabel: 'Author',
  updatedLabel: 'Updated',
  fileCountLabel: 'File count',
  detailsSectionTitle: 'Details',
};

/** Empty, successful file listing — lets `buildSkillOverview` run so the metadata response's `author` is observable. */
const emptyFileListing = { bucket: 'my-bucket', path: '', items: [] };

const makeApi = (overrides?: Partial<SkillDetailsApi>): SkillDetailsApi => ({
  downloadSkillFile: vi.fn().mockRejectedValue(new Error('no manifest')),
  listSkillFiles: vi.fn().mockResolvedValue(emptyFileListing),
  getSkillMetadata: vi.fn().mockRejectedValue(new Error('no metadata')),
  ...overrides,
});

const makeOptions = (
  api: SkillDetailsApi,
  skillId: string | null,
): UseSkillDetailsPanelDataOptions => ({
  api,
  skills: [SKILL_A, SKILL_B],
  skillId,
  folderLabels,
  skillOverviewLabels,
  favoriteIds: new Set(),
});

const authorOf = (
  detailsPanelItem: ReturnType<
    typeof useSkillDetailsPanelData
  >['detailsPanelItem'],
): string | undefined =>
  detailsPanelItem?.details?.overview?.sections
    .flatMap((section) => section.specs)
    .find((spec) => spec.label === 'Author')?.value as string | undefined;

describe('useSkillDetailsPanelData', () => {
  it('applies only the second result when the same skill is closed and reopened while the first request is pending', async () => {
    const first = makeDeferred<SkillMetadataItemDto>();
    const second = makeDeferred<SkillMetadataItemDto>();
    const getSkillMetadata = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const api = makeApi({ getSkillMetadata });

    const { result, rerender } = renderHook(
      (skillId: string | null) =>
        useSkillDetailsPanelData(makeOptions(api, skillId)),
      { initialProps: SKILL_A.url as string | null },
    );

    expect(result.current.isDetailsLoading).toBe(true);

    /* Close, then reopen the same skill before the first request settles. */
    rerender(null);
    rerender(SKILL_A.url);

    /* The stale first response resolves after the reopen — must not land. */
    first.resolve({ ...SKILL_A, author: 'first-response@example.com' });
    second.resolve({ ...SKILL_A, author: 'second-response@example.com' });

    await waitFor(() => expect(result.current.isDetailsLoading).toBe(false));

    expect(authorOf(result.current.detailsPanelItem)).toBe(
      'second-response@example.com',
    );
    expect(getSkillMetadata).toHaveBeenCalledTimes(2);
  });

  it('discards the first response when switching to a different skill mid-flight', async () => {
    const first = makeDeferred<SkillMetadataItemDto>();
    const second = makeDeferred<SkillMetadataItemDto>();
    const getSkillMetadata = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const api = makeApi({ getSkillMetadata });

    const { result, rerender } = renderHook(
      (skillId: string | null) =>
        useSkillDetailsPanelData(makeOptions(api, skillId)),
      { initialProps: SKILL_A.url as string | null },
    );

    rerender(SKILL_B.url);

    /* Stale response for A resolves after B's fetch has started. */
    first.resolve({ ...SKILL_A, author: 'skill-a-author@example.com' });
    second.resolve({ ...SKILL_B, author: 'skill-b-author@example.com' });

    await waitFor(() => expect(result.current.isDetailsLoading).toBe(false));

    expect(result.current.detailsPanelItem?.id).toBe(SKILL_B.url);
    expect(authorOf(result.current.detailsPanelItem)).toBe(
      'skill-b-author@example.com',
    );
  });

  it('issues no additional fetch on a favorite toggle or a listings refresh', async () => {
    const api = makeApi({
      getSkillMetadata: vi.fn().mockResolvedValue(SKILL_A),
    });

    const { rerender } = renderHook(
      (options: UseSkillDetailsPanelDataOptions) =>
        useSkillDetailsPanelData(options),
      { initialProps: makeOptions(api, SKILL_A.url) },
    );

    await waitFor(() => expect(api.getSkillMetadata).toHaveBeenCalledTimes(1));

    /* Favorite toggle: a new favoriteIds Set, same skillId. */
    rerender({
      ...makeOptions(api, SKILL_A.url),
      favoriteIds: new Set([SKILL_A.url]),
    });
    /* Listings refresh: a new skills array, same skillId. */
    rerender({ ...makeOptions(api, SKILL_A.url), skills: [SKILL_A, SKILL_B] });

    expect(api.getSkillMetadata).toHaveBeenCalledTimes(1);
  });

  it('applies no result once skillId becomes null', async () => {
    const deferred = makeDeferred<SkillMetadataItemDto>();
    const api = makeApi({
      getSkillMetadata: vi.fn().mockReturnValue(deferred.promise),
    });

    const { result, rerender } = renderHook(
      (skillId: string | null) =>
        useSkillDetailsPanelData(makeOptions(api, skillId)),
      { initialProps: SKILL_A.url as string | null },
    );

    rerender(null);
    deferred.resolve(SKILL_A);

    /* Give the resolved (but cancelled) response a turn to apply, if it wrongly could. */
    await Promise.resolve();

    expect(result.current.detailsPanelItem).toBeNull();
  });
});
