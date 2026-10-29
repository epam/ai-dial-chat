import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskSkillDisplayNames as useNames } from '../useScheduledTaskSkillDisplayNames';

const { metadata, listing } = vi.hoisted(() => ({
  metadata: vi.fn(),
  listing: vi.fn(),
}));
const getMetadata = (url: string, signal: AbortSignal) =>
  metadata('public', url.split('/').slice(2).join('/'), signal);
const useScheduledTaskSkillDisplayNames = (skillUrls?: string[]) => {
  const data = listing();
  const listed = new Map<string, string>(
    [...data.skills, ...data.publicSkills].map(
      (skill: { url: string; name: string }) => [skill.url, skill.name],
    ),
  );
  return useNames({ skillUrls, listed, getMetadata });
};
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

it('aborts metadata on unmount and ignores its late result', async () => {
  let signal!: AbortSignal;
  let finish!: (value: { name: string }) => void;
  const load = vi.fn((_url: string, abort: AbortSignal) => {
    signal = abort;
    return new Promise<{ name: string }>((resolve) => {
      finish = resolve;
    });
  });
  const { result, unmount } = renderHook(() =>
    useNames({
      skillUrls: ['reference'],
      listed: new Map(),
      getMetadata: load,
    }),
  );
  expect(result.current).toEqual(['reference']);
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ name: 'Late' }));
  expect(result.current).toEqual(['reference']);
});
