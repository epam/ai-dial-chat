import { TextRefinementPurpose } from '@epam/ai-dial-chat-api-client';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppConfig } from '../../context/AppConfigContext';
import { refineText } from '../../server-api/text-refinement.api';
import { UserConfigStatus } from '../../types/user-config-status';
import { useTextRefinementCallback } from '../useTextRefinementCallback';

vi.mock('../../context/AppConfigContext', () => ({ useAppConfig: vi.fn() }));
vi.mock('../../server-api/text-refinement.api', () => ({
  refineText: vi.fn(),
}));

describe('Host refinement capability', () => {
  beforeEach(() => vi.resetAllMocks());
  const configure = (available?: boolean, status = UserConfigStatus.Ready) => {
    vi.mocked(useAppConfig).mockReturnValue({
      status,
      config: { aiTextRefinementAvailable: available },
    } as ReturnType<typeof useAppConfig>);
  };
  it.each([undefined, false])(
    'omits callbacks for unavailable or older config (%s)',
    (available) => {
      configure(available);
      const { result } = renderHook(() =>
        useTextRefinementCallback(TextRefinementPurpose.SkillDescription),
      );
      expect(result.current).toBeUndefined();
    },
  );
  it('waits until configuration is ready', () => {
    configure(true, UserConfigStatus.Loading);
    const { result } = renderHook(() =>
      useTextRefinementCallback(TextRefinementPurpose.SkillDescription),
    );
    expect(result.current).toBeUndefined();
  });
  it.each(Object.values(TextRefinementPurpose))(
    'supplies stable callback and maps %s at the host edge',
    async (purpose) => {
      configure(true);
      vi.mocked(refineText).mockResolvedValue('Refined');
      const { result, rerender } = renderHook(() =>
        useTextRefinementCallback(purpose),
      );
      const original = result.current;
      rerender();
      expect(result.current).toBe(original);
      const signal = new AbortController().signal;
      await expect(result.current?.('Original', signal)).resolves.toBe(
        'Refined',
      );
      expect(refineText).toHaveBeenCalledWith(purpose, 'Original', signal);
      configure(false);
      rerender();
      expect(result.current).toBeUndefined();
    },
  );
});
