import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnavailableScheduledTaskSkills } from '../useUnavailableScheduledTaskSkills';

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
