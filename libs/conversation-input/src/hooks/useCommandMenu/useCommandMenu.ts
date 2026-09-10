import { useCallback, useEffect, useState } from 'react';
import type { CommandMenuConfig } from '../../models/Input';

/*
 * Returns whether `value` is the trigger prefix followed by a query with no
 * whitespace and no second prefix character — the only value shape the menu
 * stays open for.
 */
const isCommandValue = (value: string, prefix: string): boolean => {
  if (!value.startsWith(prefix)) {
    return false;
  }

  const query = value.slice(prefix.length);
  return !/\s/.test(query) && !query.includes(prefix);
};

/** Parameters accepted by the `useCommandMenu` hook. */
export interface UseCommandMenuParams {
  /** Command-menu configuration; `undefined` disables the mechanism entirely. */
  config: CommandMenuConfig | undefined;
  /** Current textarea value, observed on every change. */
  message: string;
}

/**
 * State machine behind the `commandMenu` prop of `Input`: opens on the
 * keystroke that turns an empty textarea into the bare trigger prefix, stays
 * open while the value keeps matching the prefix + query shape, and closes on
 * unmatch or an explicit dismissal.
 */
export const useCommandMenu = ({ config, message }: UseCommandMenuParams) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /*
   * Latch set by an explicit dismissal (Escape / outside click) and cleared
   * once the value stops matching, so a dismissed menu reopens only after the
   * user deletes the text and enters the prefix again — never while the value
   * still matches.
   */
  const [isDismissed, setIsDismissed] = useState(false);

  const query =
    config != null && isCommandValue(message, config.triggerPrefix)
      ? message.slice(config.triggerPrefix.length)
      : '';

  /*
   * Opens the menu only on the keystroke that turns an empty textarea into
   * the bare prefix. A pasted `/query` never transitions through the bare
   * prefix, so pasting opens nothing; IME composition events are ignored,
   * matching the component's other key handling.
   */
  const handleValueChange = useCallback(
    (nextValue: string, isComposing: boolean) => {
      if (config == null || isComposing) {
        return;
      }

      if (
        message === '' &&
        nextValue === config.triggerPrefix &&
        !isDismissed
      ) {
        setIsMenuOpen(true);
      }
    },
    [config, message, isDismissed],
  );

  /*
   * Closes on unmatch — covering observed keystrokes and unobserved value
   * changes alike (prop sync, send-clear, history navigation) — and clears
   * the dismissal latch at the same time. Never opens: opening is
   * keystroke-only.
   */
  useEffect(() => {
    if (config == null) {
      setIsMenuOpen(false);
      setIsDismissed(false);
      return;
    }

    if (!isCommandValue(message, config.triggerPrefix)) {
      setIsMenuOpen(false);
      setIsDismissed(false);
    }
  }, [config, message]);

  const dismiss = useCallback(() => {
    setIsMenuOpen(false);
    setIsDismissed(true);
  }, []);

  return { isMenuOpen, query, dismiss, handleValueChange };
};
