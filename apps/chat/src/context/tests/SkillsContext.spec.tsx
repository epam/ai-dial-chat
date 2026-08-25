import {
  SkillMetadataItemDtoNodeTypeEnum,
  type SkillCatalogListResponseDto,
  type SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCatalogSkills } from '../../server-api/skills.api';
import { AuthStatus } from '../../types/auth-status';
import { SkillsProvider, useSkills } from '../SkillsContext';

vi.mock('../../server-api/skills.api', () => ({
  listCatalogSkills: vi.fn(),
}));

const mockIsFeatureEnabled = vi.fn(() => true);
vi.mock('../../hooks/useUiFeature', () => ({
  useUiFeature: () => mockIsFeatureEnabled(),
}));

const mockUser = vi.fn(() => ({ status: AuthStatus.Authenticated }));
vi.mock('../auth/UserContext', () => ({ useUser: () => mockUser() }));

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

const wrapper = ({ children }: { children: ReactNode }) => (
  <SkillsProvider>{children}</SkillsProvider>
);

describe('SkillsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFeatureEnabled.mockReturnValue(true);
    mockUser.mockReturnValue({ status: AuthStatus.Authenticated });
    vi.mocked(listCatalogSkills).mockResolvedValue(aggregateResponse);
  });

  it('loads personal, shared, and organisation skills with one request', async () => {
    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listCatalogSkills).toHaveBeenCalledOnce();
    expect(result.current.skills).toEqual(aggregateResponse.skills);
    expect(result.current.sharedWithMe).toEqual(aggregateResponse.sharedWithMe);
    expect(result.current.publicSkills).toEqual(aggregateResponse.publicSkills);
    expect(result.current.error).toBeNull();
  });

  it('settles with the aggregate request error', async () => {
    const failure = new Error('down');
    vi.mocked(listCatalogSkills).mockRejectedValue(failure);

    const { result } = renderHook(() => useSkills(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.skills).toEqual([]);
    expect(result.current.publicSkills).toEqual([]);
    expect(result.current.error).toBe(failure);
  });

  it('refetches the complete aggregate snapshot', async () => {
    const { result } = renderHook(() => useSkills(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(listCatalogSkills).mockResolvedValue({
      skills: [makeSkill('new')],
      sharedWithMe: [],
      publicSkills: [],
    });

    await act(async () => result.current.refetchSkills());

    expect(result.current.skills.map((skill) => skill.name)).toEqual(['new']);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.publicSkills).toEqual([]);
  });

  it('issues no request when the skills feature is disabled', async () => {
    mockIsFeatureEnabled.mockReturnValue(false);

    const { result } = renderHook(() => useSkills(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listCatalogSkills).not.toHaveBeenCalled();
  });

  it('waits until the user profile has settled', async () => {
    mockUser.mockReturnValue({ status: AuthStatus.Loading });

    const { result } = renderHook(() => useSkills(), { wrapper });

    expect(listCatalogSkills).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useSkills())).toThrow(
      'useSkills must be used within a SkillsProvider',
    );
  });
});
