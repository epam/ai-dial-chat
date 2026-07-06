import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useInputHistoryNavigation } from '../useInputHistoryNavigation';

const HISTORY = ['first message', 'second message', 'third message'];

describe('useInputHistoryNavigation', () => {
  describe('navigate up — basic history recall', () => {
    it('returns the most-recent entry on first Up press from draft', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      const value = result.current.navigate('up', 'draft text', 0);
      expect(value).toBe('third message');
    });

    it('returns the next older entry on subsequent Up presses', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0); // third
      const value = result.current.navigate('up', 'third message', 0);
      expect(value).toBe('second message');
    });

    it('returns null when already at the oldest entry', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0); // third
      result.current.navigate('up', 'third message', 0); // second
      result.current.navigate('up', 'second message', 0); // first
      const value = result.current.navigate('up', 'first message', 0);
      expect(value).toBeNull();
    });

    it('returns null when history is empty', () => {
      const { result } = renderHook(() => useInputHistoryNavigation([]));
      expect(result.current.navigate('up', '', 0)).toBeNull();
    });

    it('returns null when history is undefined', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(undefined));
      expect(result.current.navigate('up', '', 0)).toBeNull();
    });
  });

  describe('navigate up — cursor line guard', () => {
    it('returns null when cursor is not on the first line', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      // "line1\nline2" — cursor at position 8 (on line 2)
      const value = result.current.navigate('up', 'line1\nline2', 8);
      expect(value).toBeNull();
    });

    it('intercepts when cursor is at position 0 on first line', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      const value = result.current.navigate('up', 'some draft', 0);
      expect(value).toBe('third message');
    });

    it('intercepts when cursor is mid-content on first line (no newline before cursor)', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      // "hello" cursor at 3 — still on first line
      const value = result.current.navigate('up', 'hello', 3);
      expect(value).toBe('third message');
    });
  });

  describe('navigate down — returning to draft', () => {
    it('restores saved draft when pressing Down past the most-recent entry', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', 'my draft', 7); // enters history, saves draft
      /*
       * After one up we're at the most-recent entry.
       * Pressing down once should restore the saved draft.
       */
      const value = result.current.navigate(
        'down',
        'third message',
        'third message'.length,
      );
      expect(value).toBe('my draft');
    });

    it('navigates toward more-recent entry before restoring draft', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', 'draft', 5); // → third (index 2)
      result.current.navigate('up', 'third message', 0); // → second (index 1)
      result.current.navigate('up', 'second message', 0); // → first (index 0)

      const third = result.current.navigate(
        'down',
        'first message',
        'first message'.length,
      );
      expect(third).toBe('second message');

      const second = result.current.navigate(
        'down',
        'second message',
        'second message'.length,
      );
      expect(second).toBe('third message');

      const draft = result.current.navigate(
        'down',
        'third message',
        'third message'.length,
      );
      expect(draft).toBe('draft');
    });

    it('returns null when not in history mode', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      expect(result.current.navigate('down', 'anything', 8)).toBeNull();
    });

    it('returns saved draft when cursor is on the last line', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0); // enter history mode
      // cursor is mid-content with text after it on the same line
      const value = result.current.navigate('down', 'third message', 3);
      /*
       * 'third message'.slice(3) has no \n, so cursor is on the last line.
       * Because we're at the most-recent history item, Down restores saved draft.
       */
      expect(value).toBe('');
    });

    it('returns null when cursor is not on the last line with newlines', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0);
      const value = result.current.navigate('down', 'line1\nline2', 3);
      // cursor at 3 (on line1), 'line1\nline2'.slice(3) = 'e1\nline2' contains \n
      expect(value).toBeNull();
    });
  });

  describe('notifyChange — exits history mode on edit', () => {
    it('resets index so subsequent Up starts fresh', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0); // → third
      act(() => {
        result.current.notifyChange();
      });
      // After reset, next Up should again return the most-recent entry
      const value = result.current.navigate('up', 'edited', 6);
      expect(value).toBe('third message');
    });
  });

  describe('reset — clears state on send', () => {
    it('resets index so subsequent Up starts fresh after send', () => {
      const { result } = renderHook(() => useInputHistoryNavigation(HISTORY));
      result.current.navigate('up', '', 0); // → third
      act(() => {
        result.current.reset();
      });
      const value = result.current.navigate('up', '', 0);
      expect(value).toBe('third message');
    });
  });

  describe('stable reference', () => {
    it('returns the same object reference when history does not change', () => {
      const { result, rerender } = renderHook(
        ({ h }) => useInputHistoryNavigation(h),
        { initialProps: { h: HISTORY } },
      );
      const first = result.current;
      rerender({ h: HISTORY });
      expect(result.current).toBe(first);
    });
  });
});
