import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskSkillDisplayNames } from '../useScheduledTaskSkillDisplayNames';

const { metadata, listing } = vi.hoisted(() => ({
  metadata: vi.fn(),
  listing: vi.fn(),
}));
vi.mock('../../../context/SkillsContext', () => ({ useSkills: listing }));
vi.mock('../../../server-api/skills.api', () => ({
  getSkillMetadata: metadata,
}));

describe('scheduled task skill display', () => {
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
    await waitFor(() => expect(result.current).toEqual(['Former name']));
    rerender({ urls: undefined });
    rerender({ urls: ['skills/public/report'] });
    await waitFor(() => expect(metadata).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual(['skills/public/report']);
  });
  beforeEach(() => {
    metadata.mockReset();
    listing.mockReturnValue({ skills: [], publicSkills: [] });
  });

  it('uses resolved catalog data without a request', () => {
    listing.mockReturnValue({
      skills: [{ url: 'skills/public/report', name: 'Report' }],
      publicSkills: [],
    });
    const { result } = renderHook(() =>
      useScheduledTaskSkillDisplayNames(['skills/public/report']),
    );
    expect(result.current).toEqual(['Report']);
    expect(metadata).not.toHaveBeenCalled();
  });

  it.each([403, 404, 503])(
    'retains the full reference when metadata returns %s',
    async (status) => {
      metadata.mockRejectedValue({ response: { status } });
      const { result } = renderHook(() =>
        useScheduledTaskSkillDisplayNames(['skills/public/missing']),
      );
      expect(result.current).toEqual(['skills/public/missing']);
      await waitFor(() => expect(metadata).toHaveBeenCalled());
      expect(result.current).toEqual(['skills/public/missing']);
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
    expect(result.current).toEqual(['skills/public/old']);
    rerender({ urls: ['skills/public/current'] });
    await waitFor(() => expect(result.current).toEqual(['Current']));
    await act(async () => finish({ name: 'Old' }));
    expect(result.current).toEqual(['Current']);
    rerender({ urls: undefined });
    expect(result.current).toEqual([]);
  });
});

it('resolves listed and missing references independently in order', async () => {
  listing.mockReturnValue({
    skills: [{ url: 'skills/public/report', name: 'Report' }],
    publicSkills: [],
  });
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
    ]),
  );
  await waitFor(() =>
    expect(result.current).toEqual([
      'Report',
      'Summary',
      'skills/public/deleted',
    ]),
  );
});
