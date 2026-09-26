import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useScheduledTaskSkillDisplayName } from '../useScheduledTaskSkillDisplayName';

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
      ({ url }: { url?: string }) => useScheduledTaskSkillDisplayName(url),
      { initialProps: { url: 'skills/public/report' } as { url?: string } },
    );
    await waitFor(() => expect(result.current).toBe('Former name'));
    rerender({ url: undefined });
    rerender({ url: 'skills/public/report' });
    await waitFor(() => expect(metadata).toHaveBeenCalledTimes(2));
    expect(result.current).toBe('skills/public/report');
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
      useScheduledTaskSkillDisplayName('skills/public/report'),
    );
    expect(result.current).toBe('Report');
    expect(metadata).not.toHaveBeenCalled();
  });

  it.each([403, 404, 503])(
    'retains the full reference when metadata returns %s',
    async (status) => {
      metadata.mockRejectedValue({ response: { status } });
      const { result } = renderHook(() =>
        useScheduledTaskSkillDisplayName('skills/public/missing'),
      );
      expect(result.current).toBe('skills/public/missing');
      await waitFor(() => expect(metadata).toHaveBeenCalled());
      expect(result.current).toBe('skills/public/missing');
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
      ({ url }: { url?: string }) => useScheduledTaskSkillDisplayName(url),
      { initialProps: { url: 'skills/public/old' } as { url?: string } },
    );
    expect(result.current).toBe('skills/public/old');
    rerender({ url: 'skills/public/current' });
    await waitFor(() => expect(result.current).toBe('Current'));
    await act(async () => finish({ name: 'Old' }));
    expect(result.current).toBe('Current');
    rerender({ url: undefined });
    expect(result.current).toBeUndefined();
  });
});
