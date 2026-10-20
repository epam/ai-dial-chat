import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksI18nKeys } from '../../../constants/translation-keys';
import { useScheduledTaskSkillDisplayNames } from '../useScheduledTaskSkillDisplayNames';

const { metadata, listing, user } = vi.hoisted(() => ({
  metadata: vi.fn(),
  listing: vi.fn(),
  user: vi.fn(),
}));
vi.mock('../../../context/SkillsContext', () => ({ useSkills: listing }));
vi.mock('../../../context/auth/UserContext', () => ({ useUser: user }));
vi.mock('../../../server-api/skills.api', () => ({
  getSkillMetadata: metadata,
}));
vi.mock('react-i18next', () => {
  const t = (key: string, params?: { name?: string }) =>
    params?.name == null ? key : `${key}:${params.name}`;
  return { useTranslation: () => ({ t }) };
});

const unavailable = (name: string) =>
  `${ScheduledTasksI18nKeys.CreateSkillUnavailableLabel}:${name}`;

const settledListing = (
  overrides: Partial<{
    skills: { url: string; name: string }[];
    isLoading: boolean;
    error: unknown;
  }> = {},
) => ({
  skills: [],
  publicSkills: [],
  isEnabled: true,
  isLoading: false,
  error: null,
  ...overrides,
});

describe('useScheduledTaskSkillDisplayNames', () => {
  beforeEach(() => {
    metadata.mockReset();
    listing.mockReturnValue(settledListing());
    user.mockReturnValue({ user: { bucket: 'own' } });
  });

  it('does not reuse old metadata when the same reference becomes unreadable', async () => {
    metadata
      .mockResolvedValueOnce({ name: 'Former name' })
      .mockRejectedValue(new Error('Deleted'));
    const { result, rerender } = renderHook(
      ({ urls }: { urls?: string[] }) =>
        useScheduledTaskSkillDisplayNames(urls),
      {
        initialProps: { urls: ['skills/public/report'] } as { urls?: string[] },
      },
    );
    await waitFor(() => expect(result.current.names).toEqual(['Former name']));
    rerender({ urls: undefined });
    rerender({ urls: ['skills/public/report'] });
    await waitFor(() => expect(metadata).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(result.current.names).toEqual([unavailable('report')]),
    );
  });

  it('uses resolved catalog data without a request', () => {
    listing.mockReturnValue(
      settledListing({
        skills: [{ url: 'skills/public/report', name: 'Report' }],
      }),
    );
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames(['skills/public/report']),
    );
    expect(result.current.names).toEqual(['Report']);
    expect(metadata).not.toHaveBeenCalled();
  });

  it('marks a deleted own-bucket skill unavailable without a metadata request', () => {
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames(['skills/own/folder/My%20skill']),
    );
    expect(result.current.names).toEqual([unavailable('My skill')]);
    expect(result.current.unavailableUrls).toEqual([
      'skills/own/folder/My%20skill',
    ]);
    expect(metadata).not.toHaveBeenCalled();
  });

  it('waits for the skill listing before looking up metadata', () => {
    listing.mockReturnValue(settledListing({ isLoading: true }));
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames(['skills/other/report']),
    );
    expect(result.current.names).toEqual(['report']);
    expect(result.current.unavailableUrls).toEqual([]);
    expect(metadata).not.toHaveBeenCalled();
  });

  it('looks up an own-bucket skill when the listing failed', async () => {
    listing.mockReturnValue(settledListing({ error: new Error('Offline') }));
    metadata.mockResolvedValue({ name: 'Report' });
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames(['skills/own/report']),
    );
    await waitFor(() => expect(result.current.names).toEqual(['Report']));
    expect(metadata).toHaveBeenCalledOnce();
  });

  it.each([400, 403, 404, 503])(
    'shows the skill name marked unavailable when metadata returns %s',
    async (status) => {
      metadata.mockRejectedValue({ response: { status } });
      const { result } = renderHook(() =>
        useScheduledTaskSkillDisplayNames(['skills/public/missing']),
      );
      expect(result.current.names).toEqual(['missing']);
      await waitFor(() =>
        expect(result.current.names).toEqual([unavailable('missing')]),
      );
    },
  );

  it('ignores stale metadata after replacement and hides an absent selection', async () => {
    let finish!: (value: { name: string }) => void;
    metadata
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue({ name: 'Current' });
    const { result, rerender } = renderHook(
      ({ urls }: { urls?: string[] }) =>
        useScheduledTaskSkillDisplayNames(urls),
      { initialProps: { urls: ['skills/public/old'] } as { urls?: string[] } },
    );
    expect(result.current.names).toEqual(['old']);
    rerender({ urls: ['skills/public/current'] });
    await waitFor(() => expect(result.current.names).toEqual(['Current']));
    await act(async () => finish({ name: 'Old' }));
    expect(result.current.names).toEqual(['Current']);
    rerender({ urls: undefined });
    expect(result.current.names).toEqual([]);
  });

  it('resolves listed, looked-up, and missing references independently in order', async () => {
    listing.mockReturnValue(
      settledListing({
        skills: [{ url: 'skills/public/report', name: 'Report' }],
      }),
    );
    metadata.mockImplementation((_bucket, path) =>
      path === 'summary'
        ? Promise.resolve({ name: 'Summary' })
        : Promise.reject(new Error('Deleted')),
    );
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames([
        'skills/public/report',
        'skills/public/summary',
        'skills/public/deleted',
        'skills/own/removed',
      ]),
    );
    await waitFor(() =>
      expect(result.current.names).toEqual([
        'Report',
        'Summary',
        unavailable('deleted'),
        unavailable('removed'),
      ]),
    );
    expect(result.current.unavailableUrls).toEqual([
      'skills/public/deleted',
      'skills/own/removed',
    ]);
    expect(result.current.unavailableIndexes).toEqual([2, 3]);
    expect(metadata).toHaveBeenCalledTimes(2);
  });
});
