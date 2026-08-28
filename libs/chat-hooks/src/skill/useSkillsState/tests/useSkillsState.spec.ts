import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillCatalogListResponseDto,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';
import { useSkillsState, type UseSkillsStateParams } from '../useSkillsState';

const makeSkill = (
  name: string,
  bucket = 'my-bucket',
): SkillMetadataItemDto => ({
  name,
  path: name,
  url: `skills/${bucket}/${name}`,
  bucket,
  nodeType: SkillMetadataItemDtoNodeTypeEnum.Item,
  updatedAt: 2,
});

const aggregateResponse: SkillCatalogListResponseDto = {
  skills: [makeSkill('personal')],
  sharedWithMe: [makeSkill('shared', 'owner-bucket')],
  publicSkills: [makeSkill('public-skill', 'public')],
};

describe('useSkillsState', () => {
  let listSkills: MockedFunction<UseSkillsStateParams['listSkills']>;

  beforeEach(() => {
    vi.clearAllMocks();
    listSkills = vi.fn().mockResolvedValue(aggregateResponse);
  });

  it('calls listSkills once and populates all three arrays when enabled and ready', async () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listSkills).toHaveBeenCalledOnce();
    expect(result.current.skills).toEqual(aggregateResponse.skills);
    expect(result.current.sharedWithMe).toEqual(aggregateResponse.sharedWithMe);
    expect(result.current.publicSkills).toEqual(aggregateResponse.publicSkills);
    expect(result.current.error).toBeNull();
  });

  it('clears state and settles loading immediately when disabled', async () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: false, ready: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listSkills).not.toHaveBeenCalled();
    expect(result.current.skills).toEqual([]);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.publicSkills).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('defers the fetch when enabled but not ready', () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: false }),
    );

    expect(listSkills).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });

  it('runs the fetch once ready becomes true', async () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) =>
        useSkillsState({ listSkills, enabled: true, ready }),
      { initialProps: { ready: false } },
    );

    expect(listSkills).not.toHaveBeenCalled();

    rerender({ ready: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listSkills).toHaveBeenCalledOnce();
  });

  it('sets error and keeps arrays when the fetch rejects', async () => {
    const failure = new Error('down');
    listSkills.mockRejectedValueOnce(failure);

    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe(failure);
    expect(result.current.skills).toEqual([]);
  });

  it('replaces all arrays on refetch success', async () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const fresh: SkillCatalogListResponseDto = {
      skills: [makeSkill('new')],
      sharedWithMe: [],
      publicSkills: [],
    };
    listSkills.mockResolvedValueOnce(fresh);

    await act(async () => result.current.refetch());

    expect(result.current.skills.map((s) => s.name)).toEqual(['new']);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.publicSkills).toEqual([]);
  });

  it('upserts by url: replaces an existing entry with the same url', async () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const original = makeSkill('shared', 'owner-bucket');
    const updated = { ...original, name: 'shared-updated' };

    act(() => result.current.mergeSharedSkill(updated));

    expect(result.current.sharedWithMe).toHaveLength(1);
    expect(result.current.sharedWithMe[0].name).toBe('shared-updated');
  });

  it('upserts by url: appends when the url is new', async () => {
    const { result } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newSkill = makeSkill('brand-new', 'other-bucket');
    act(() => result.current.mergeSharedSkill(newSkill));

    expect(result.current.sharedWithMe).toHaveLength(2);
    expect(
      result.current.sharedWithMe.some((s) => s.name === 'brand-new'),
    ).toBe(true);
  });

  it('refetch and mergeSharedSkill have stable identities across unrelated re-renders', async () => {
    const { result, rerender } = renderHook(() =>
      useSkillsState({ listSkills, enabled: true, ready: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const { refetch, mergeSharedSkill } = result.current;
    rerender();

    expect(result.current.refetch).toBe(refetch);
    expect(result.current.mergeSharedSkill).toBe(mergeSharedSkill);
  });
});
