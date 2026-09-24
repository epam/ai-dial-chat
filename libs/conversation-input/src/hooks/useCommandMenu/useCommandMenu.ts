import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { CommandMenuConfig } from '../../models/Input';

/* Character offset immediately after the run of non-whitespace text starting at `start`. */
const findWordEnd = (text: string, start: number): number => {
  let end = start;
  while (end < text.length && !/\s/.test(text[end])) {
    end++;
  }
  return end;
};

/* The contiguous non-whitespace run containing (or ending at) `caretPosition`. */
const findWordAtCaret = (
  text: string,
  caretPosition: number,
): { start: number; end: number } => {
  let start = caretPosition;
  while (start > 0 && !/\s/.test(text[start - 1])) {
    start--;
  }
  return { start, end: findWordEnd(text, start) };
};

/*
 * Whether `word` is the trigger prefix followed by a query with no second
 * prefix character — the only word shape the menu opens or stays open for.
 * `word` never contains whitespace by construction (see `findWordAtCaret`).
 */
const isCommandShaped = (word: string, prefix: string): boolean =>
  word.startsWith(prefix) && !word.slice(prefix.length).includes(prefix);

/* Options the keyboard can land on: every `role="option"` not marked disabled. */
const OPTION_SELECTOR = '[role="option"]:not([aria-disabled="true"])';

/** Direction the active option moves in on an arrow key. */
export enum CommandMenuOptionStep {
  Next = 'next',
  Previous = 'previous',
}

/** Parameters accepted by the `useCommandMenu` hook. */
export interface UseCommandMenuParams {
  /** Command-menu configuration; `undefined` disables the mechanism entirely. */
  config: CommandMenuConfig | undefined;
  /** Current textarea value, observed on every change. */
  message: string;
}

/**
 * State machine behind the `commandMenu` prop of `Input`: opens whenever the
 * word at the caret becomes the trigger prefix plus a whitespace-free query,
 * anywhere in the textarea — not only when the textarea is otherwise empty —
 * stays open while that same word keeps matching, and closes the moment it
 * stops. Reaching the bare trigger character always (re)opens the menu, even
 * over a word an explicit dismissal previously closed; a dismissal otherwise
 * stays in effect only while the caret remains in that same word. Also drives
 * the menu's keyboard navigation: the arrows move an active option read off
 * the rendered overlay's DOM, and the active option is exposed via
 * `aria-activedescendant`.
 */
export const useCommandMenu = ({ config, message }: UseCommandMenuParams) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /* Start offset of the word the menu is currently open for, or was last open for. */
  const [activeWordStart, setActiveWordStart] = useState<number | null>(null);
  /* Start offset of the word an explicit dismissal (Escape / outside click) closed. */
  const [dismissedWordStart, setDismissedWordStart] = useState<number | null>(
    null,
  );
  /*
   * Mirrors `activeWordStart`, read (never written) by the closing effect
   * below. The effect must not depend on `activeWordStart` itself — that
   * state is set by `handleValueChange` in the same commit as `message`'s own
   * update, and depending on it would run the effect one commit early,
   * against the *previous* `message` value, and incorrectly close a menu
   * `handleValueChange` just opened.
   */
  const activeWordStartRef = useRef<number | null>(null);
  activeWordStartRef.current = activeWordStart;

  const query =
    config != null &&
    activeWordStart != null &&
    activeWordStart <= message.length
      ? (() => {
          const word = message.slice(
            activeWordStart,
            findWordEnd(message, activeWordStart),
          );
          return isCommandShaped(word, config.triggerPrefix)
            ? word.slice(config.triggerPrefix.length)
            : '';
        })()
      : '';

  /*
   * Opens/updates on every keystroke, evaluated against the word surrounding
   * the caret rather than the whole message, so the menu reacts to a trigger
   * typed anywhere in the text (start, middle, or after other words) exactly
   * as it does over an empty textarea.
   */
  const handleValueChange = useCallback(
    (nextValue: string, caretPosition: number, isComposing: boolean) => {
      if (config == null || isComposing) return;

      const { start, end } = findWordAtCaret(nextValue, caretPosition);
      const word = nextValue.slice(start, end);

      if (!isCommandShaped(word, config.triggerPrefix)) {
        setIsMenuOpen(false);
        setDismissedWordStart(null);
        setActiveWordStart(null);
        return;
      }

      setActiveWordStart(start);

      const isBareTrigger = word === config.triggerPrefix;
      if (isBareTrigger || dismissedWordStart !== start) {
        setIsMenuOpen(true);
        setDismissedWordStart(null);
        return;
      }

      setIsMenuOpen(false);
    },
    [config, dismissedWordStart],
  );

  /*
   * Fallback for value changes `handleValueChange` never observes — prop
   * sync, send-clear, history navigation, an external reset. Re-validates
   * the tracked word against the new message and closes on mismatch; agrees
   * with `handleValueChange`'s own decision on any change it did observe, so
   * the two never fight over the same render.
   */
  useEffect(() => {
    if (config == null) {
      setIsMenuOpen(false);
      setDismissedWordStart(null);
      setActiveWordStart(null);
      return;
    }

    const trackedStart = activeWordStartRef.current;
    if (trackedStart == null) return;

    const start = Math.min(trackedStart, message.length);
    const word = message.slice(start, findWordEnd(message, start));

    if (!isCommandShaped(word, config.triggerPrefix)) {
      setIsMenuOpen(false);
      setDismissedWordStart(null);
      setActiveWordStart(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, message]);

  const dismiss = useCallback(() => {
    setIsMenuOpen(false);
    setDismissedWordStart(activeWordStart);
  }, [activeWordStart]);

  /*
   * Keyboard navigation over the rendered menu: the options are read from the
   * overlay's DOM rather than from the host's data, because the host alone
   * decides what it lists (filtering, sections) — the contract is only that
   * each option carries `role="option"` and a unique `id`. Focus never leaves
   * the textarea; the active option is exposed via `aria-activedescendant`.
   */
  const listboxId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);

  /*
   * A new query re-filters the list, so an option made active under the
   * previous query no longer points at what the user is looking at; closing
   * drops it too, so a reopened menu starts with nothing active.
   */
  useEffect(() => {
    setActiveOptionId(null);
  }, [isMenuOpen, query]);

  const getOptions = useCallback(
    (): HTMLElement[] =>
      Array.from(
        overlayRef.current?.querySelectorAll<HTMLElement>(OPTION_SELECTOR) ??
          [],
      ),
    [],
  );

  /*
   * Moves the active option one step, wrapping around at both ends. From no
   * active option, Next lands on the first option and Previous on the last.
   */
  const moveActiveOption = useCallback(
    (step: CommandMenuOptionStep) => {
      const options = getOptions();
      if (options.length === 0) {
        setActiveOptionId(null);
        return;
      }

      const currentIndex = options.findIndex(
        (option) => option.id === activeOptionId,
      );
      const nextIndex =
        step === CommandMenuOptionStep.Next
          ? (currentIndex + 1) % options.length
          : (currentIndex <= 0 ? options.length : currentIndex) - 1;

      const nextOption = options[nextIndex];
      setActiveOptionId(nextOption.id);
      /* jsdom has no layout, so `scrollIntoView` may be missing there. */
      nextOption.scrollIntoView?.({ block: 'nearest' });
    },
    [getOptions, activeOptionId],
  );

  /*
   * The active option's element while it is still rendered — a row removed
   * since it became active (e.g. unfavorited) no longer counts.
   */
  const getActiveOption = useCallback(
    (): HTMLElement | null =>
      getOptions().find((option) => option.id === activeOptionId) ?? null,
    [getOptions, activeOptionId],
  );

  return {
    isMenuOpen,
    query,
    /** Start offset of the word driving the currently open menu, or `null` when closed. */
    activeWordStart,
    dismiss,
    handleValueChange,
    listboxId,
    overlayRef,
    activeOptionId: isMenuOpen ? activeOptionId : null,
    moveActiveOption,
    getActiveOption,
  };
};
