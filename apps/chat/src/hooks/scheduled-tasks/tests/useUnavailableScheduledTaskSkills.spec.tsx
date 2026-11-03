import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useScheduledTaskSkillDetails,
  useUnavailableScheduledTaskSkills,
} from '../useUnavailableScheduledTaskSkills';

const { metadata } = vi.hoisted(() => ({ metadata: vi.fn() }));
vi.mock('../../../context/SkillsContext', () => ({
  useSkills: () => ({ skills: [], publicSkills: [], sharedWithMe: [] }),
}));
vi.mock('../../../server-api/skills.api', () => ({
  getSkillMetadata: metadata,
}));

describe('useUnavailableScheduledTaskSkills', () => {
  beforeEach(() => {
    metadata.mockReset();
  });

  it.each([400, 403, 404])(
    'marks an HTTP %s reference unavailable',
    async (status) => {
      metadata.mockRejectedValue({
        response: { status, json: async () => ({}) },
      });
      const { result } = renderHook(() =>
        useUnavailableScheduledTaskSkills(['skills/public/report']),
      );
      await waitFor(() =>
        expect(result.current).toEqual(['skills/public/report']),
      );
    },
  );

  it('retries a 400 response after removing and restoring the reference', async () => {
    const url = 'skills/public/report';
    metadata
      .mockRejectedValueOnce({
        response: { status: 400, json: async () => ({}) },
      })
      .mockResolvedValueOnce({ name: 'Report' });
    const { result, rerender } = renderHook(
      ({ urls }) => useScheduledTaskSkillDetails(urls),
      { initialProps: { urls: [url] } },
    );
    await waitFor(() => expect(result.current[0].isUnavailable).toBe(true));
    rerender({ urls: [] });
    expect(result.current).toEqual([]);
    rerender({ urls: [url] });
    await waitFor(() =>
      expect(result.current).toEqual([
        { url, name: 'Report', isUnavailable: false, isLoading: false },
      ]),
    );
    expect(metadata).toHaveBeenCalledTimes(2);
  });

  it('does not treat a temporary server failure as deletion', async () => {
    metadata.mockRejectedValue({
      response: { status: 503, json: async () => ({}) },
    });
    const { result } = renderHook(() =>
      useUnavailableScheduledTaskSkills(['skills/public/report']),
    );
    await waitFor(() => expect(metadata).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
