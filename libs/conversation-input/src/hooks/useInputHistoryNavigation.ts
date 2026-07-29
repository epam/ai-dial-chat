import { useCallback, useMemo, useRef } from 'react';

/** Returns `true` when the cursor is on the first line of the textarea value. */
const isOnFirstLine = (value: string, cursorPos: number): boolean =>
  !value.slice(0, cursorPos).includes('\n');

/** Returns `true` when the cursor is on the last line of the textarea value. */
const isOnLastLine = (value: string, cursorPos: number): boolean =>
  !value.slice(cursorPos).includes('\n');

/** Manages keyboard-driven Up/Down navigation through a list of previously sent messages from a chat input textarea. */
export const useInputHistoryNavigation = (
  messageHistory: readonly string[] | undefined,
) => {
  const historyRef = useRef(messageHistory);
  historyRef.current = messageHistory;

  // -1 = draft mode; ≥ 0 = index into history (0 = oldest)
  const indexRef = useRef(-1);
  const savedDraftRef = useRef('');

  /**
   * Returns the textarea value to display after an arrow key press, or `null`
   * when the key should not be intercepted (cursor not on the boundary line,
   * no history available in that direction, or not in history mode for Down).
   */
  const navigate = useCallback(
    (
      direction: 'up' | 'down',
      currentValue: string,
      cursorPos: number,
    ): string | null => {
      const history = historyRef.current;
      if (!history || history.length === 0) return null;

      if (direction === 'up') {
        if (!isOnFirstLine(currentValue, cursorPos)) return null;
        // Already at the oldest entry — do not wrap.
        if (indexRef.current === 0) return null;
        if (indexRef.current === -1) {
          savedDraftRef.current = currentValue;
          indexRef.current = history.length - 1;
        } else {
          indexRef.current -= 1;
        }
        return history[indexRef.current];
      }

      // direction === 'down'
      if (indexRef.current === -1) return null;
      if (!isOnLastLine(currentValue, cursorPos)) return null;
      if (indexRef.current < history.length - 1) {
        indexRef.current += 1;
        return history[indexRef.current];
      }
      // Past the most-recent entry — restore the saved draft.
      indexRef.current = -1;
      return savedDraftRef.current;
    },
    [],
  );

  /**
   * Must be called on every textarea `onChange` event. Exits history mode
   * when the user edits content so subsequent navigation starts fresh.
   */
  const notifyChange = useCallback(() => {
    indexRef.current = -1;
    savedDraftRef.current = '';
  }, []);

  /**
   * Must be called when the user submits a message. Clears all navigation
   * state so the next Up press starts from the newly submitted message.
   */
  const reset = useCallback(() => {
    indexRef.current = -1;
    savedDraftRef.current = '';
  }, []);

  return useMemo(
    () => ({ navigate, notifyChange, reset }),
    [navigate, notifyChange, reset],
  );
};
