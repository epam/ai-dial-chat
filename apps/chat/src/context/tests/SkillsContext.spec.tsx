import type {
  SkillListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { SkillMetadataItemDtoNodeTypeEnum } from '@epam/ai-dial-chat-api-client';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listSkills } from '../../server-api/skills.api';
import { AuthStatus } from '../../types/auth-status';
import { SKILL_LISTING_MAX_PAGES } from '../../types/skill';
import { SkillsProvider, useSkills } from '../SkillsContext';

vi.mock('../../server-api/skills.api', () => ({
  listSkills: vi.fn(),
}));

const mockIsFeatureEnabled = vi.fn(() => true);
vi.mock('../../hooks/useUiFeature', () => ({
  useUiFeature: () => mockIsFeatureEnabled(),
}));

const mockUser = vi.fn(
  () =>
    ({ status: AuthStatus.Authenticated, user: { bucket: 'my-bucket' } }) as {
      status: AuthStatus;
      user: { bucket?: string };
    },
);
vi.mock('../auth/UserContext', () => ({
  useUser: () => mockUser(),
}));

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

const makeFolder = (name: string): SkillMetadataItemDto => ({
  ...makeSkill(name),
  nodeType: SkillMetadataItemDtoNodeTypeEnum.Folder,
});

const makeResponse = (
  bucket: string,
  items: SkillMetadataItemDto[],
  nextToken?: string,
): SkillListResponseDto => ({ bucket, path: '', items, nextToken });

const wrapper = ({ children }: { children: ReactNode }) => (
  <SkillsProvider>{children}</SkillsProvider>
);

const renderSkills = () => renderHook(() => useSkills(), { wrapper });

describe('SkillsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    mockUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { bucket: 'my-bucket' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes skills from both buckets once the listings resolve', async () => {
    vi.mocked(listSkills).mockImplementation(async ({ bucket }) =>
      bucket === 'public'
        ? makeResponse('public', [makeSkill('shared', 'public')])
        : makeResponse('my-bucket', [makeSkill('a'), makeSkill('b')]),
    );

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills).toHaveLength(2);
    expect(result.current.publicSkills).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('keeps the personal listing when the organisation listing fails', async () => {
    const failure = new Error('no public bucket');
    vi.mocked(listSkills).mockImplementation(async ({ bucket }) => {
      if (bucket === 'public') throw failure;
      return makeResponse('my-bucket', [makeSkill('a')]);
    });

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills).toHaveLength(1);
    expect(result.current.publicSkills).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('keeps the organisation listing when the personal listing fails', async () => {
    const failure = new Error('personal bucket unavailable');
    vi.mocked(listSkills).mockImplementation(async ({ bucket }) => {
      if (bucket === 'my-bucket') throw failure;
      return makeResponse('public', [makeSkill('shared', 'public')]);
    });

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.publicSkills).toHaveLength(1);
    expect(result.current.skills).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('settles with empty arrays when both listings fail', async () => {
    vi.mocked(listSkills).mockRejectedValue(new Error('down'));

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills).toEqual([]);
    expect(result.current.publicSkills).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it('collects every page of a multi-page listing', async () => {
    vi.mocked(listSkills).mockImplementation(async ({ bucket, token }) => {
      if (bucket !== 'my-bucket') return makeResponse('public', []);
      return token == null
        ? makeResponse('my-bucket', [makeSkill('a')], 'page-2')
        : makeResponse('my-bucket', [makeSkill('b')]);
    });

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills.map((skill) => skill.name)).toEqual([
      'a',
      'b',
    ]);
  });

  it('stops at the page cap and warns rather than paging forever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(listSkills).mockImplementation(async ({ bucket }) =>
      makeResponse(bucket, [makeSkill('a', bucket)], 'always-more'),
    );

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills).toHaveLength(SKILL_LISTING_MAX_PAGES);
    expect(warn).toHaveBeenCalled();
  });

  it('drops grouping folders from the listing', async () => {
    vi.mocked(listSkills).mockImplementation(async ({ bucket }) =>
      bucket === 'public'
        ? makeResponse('public', [])
        : makeResponse('my-bucket', [
            makeSkill('a'),
            makeFolder('team'),
            makeSkill('b'),
          ]),
    );

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.skills.map((skill) => skill.name)).toEqual([
      'a',
      'b',
    ]);
  });

  it('issues no request when the skills feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listSkills).not.toHaveBeenCalled();
    expect(result.current.skills).toEqual([]);
  });

  it('issues no request while the profile has not settled', async () => {
    mockUser.mockReturnValue({
      status: AuthStatus.Loading,
      user: { bucket: '' },
    });
    vi.mocked(listSkills).mockResolvedValue(makeResponse('public', []));

    const { result } = renderSkills();

    await waitFor(() => expect(listSkills).not.toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
  });

  /* A profile that settles without a bucket must not leave the catalog loading forever. */
  it('lists only the organisation bucket when the profile settles without one', async () => {
    mockUser.mockReturnValue({
      status: AuthStatus.Authenticated,
      user: { bucket: '' },
    });
    vi.mocked(listSkills).mockResolvedValue(
      makeResponse('public', [makeSkill('shared', 'public')]),
    );

    const { result } = renderSkills();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listSkills).toHaveBeenCalledOnce();
    expect(listSkills).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: 'public' }),
    );
    expect(result.current.skills).toEqual([]);
    expect(result.current.publicSkills).toHaveLength(1);
  });

  it('throws when the hook is used outside the provider', () => {
    expect(() => renderHook(() => useSkills())).toThrow(
      'useSkills must be used within a SkillsProvider',
    );
  });
});
