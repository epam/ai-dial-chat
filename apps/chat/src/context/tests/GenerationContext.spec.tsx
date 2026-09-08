import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { GenerationProvider, useGeneration } from '../GenerationContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <GenerationProvider>{children}</GenerationProvider>
);

describe('GenerationContext', () => {
  describe('hasActiveGeneration', () => {
    it('returns false when no generation has been started', () => {
      const { result } = renderHook(() => useGeneration(), { wrapper });

      expect(result.current.hasActiveGeneration()).toBe(false);
    });

    it('returns true while a generation is active', () => {
      const { result } = renderHook(() => useGeneration(), { wrapper });

      act(() => {
        result.current.startGeneration('path-a', 'gen-1');
      });

      expect(result.current.hasActiveGeneration()).toBe(true);
    });

    it('returns false once the only active generation completes', () => {
      const { result } = renderHook(() => useGeneration(), { wrapper });

      act(() => {
        result.current.startGeneration('path-a', 'gen-1');
      });
      act(() => {
        result.current.completeGeneration('path-a', 'gen-1');
      });

      expect(result.current.hasActiveGeneration()).toBe(false);
    });

    it('returns true when one path is active and another is done', () => {
      const { result } = renderHook(() => useGeneration(), { wrapper });

      act(() => {
        result.current.startGeneration('path-a', 'gen-1');
        result.current.completeGeneration('path-a', 'gen-1');
        result.current.startGeneration('path-b', 'gen-2');
      });

      expect(result.current.hasActiveGeneration()).toBe(true);
    });
  });

  describe('useGeneration', () => {
    it('throws when used outside a GenerationProvider', () => {
      expect(() => renderHook(() => useGeneration())).toThrow(
        'useGeneration must be used within GenerationProvider',
      );
    });
  });
});
