import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
 * State machine behind the `commandMenu` prop of `Input`: opens when an empty
 * textarea gains the trigger — typed as the bare prefix, or pasted as any
 * command-shaped value — stays open while the value keeps matching the
 * prefix + query shape, and closes on unmatch or an explicit dismissal.
 */
export const useCommandMenu = ({ config, message }: UseCommandMenuParams) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /*
   * Latch set by an explicit dismissal (Escape / outside click) and cleared
   * once the value stops matching, so a dismissed menu reopens only after the
   * user deletes the text and enters the trigger again — typed or pasted —
   * never while the value still matches.
   */
  const [isDismissed, setIsDismissed] = useState(false);

  const query =
    config != null && isCommandValue(message, config.triggerPrefix)
      ? message.slice(config.triggerPrefix.length)
      : '';

  /*
   * Opens the menu on the transition from an empty textarea into a trigger.
   * Typing opens only on the bare prefix — the single keystroke that starts
   * a command. A pasted `/query` never transitions through the bare prefix,
   * so a paste (`inputType` `insertFromPaste`) instead opens on the resulting
   * value, covering the bare prefix and any full command shape alike: the
   * paste inserts its text untouched and only the menu opens on top of it,
   * while any other pasted shape is left as a regular paste. A paste the
   * attachment pipeline intercepts (`preventDefault`) never emits an input
   * event at all. IME composition events are ignored, matching the
   * component's other key handling.
   */
  const handleValueChange = useCallback(
    (nextValue: string, isComposing: boolean, inputType?: string) => {
      if (config == null || isComposing || message !== '' || isDismissed) {
        return;
      }

      const isTypedBarePrefix = nextValue === config.triggerPrefix;
      const isPastedCommand =
        inputType === 'insertFromPaste' &&
        isCommandValue(nextValue, config.triggerPrefix);

      if (isTypedBarePrefix || isPastedCommand) {
        setIsMenuOpen(true);
      }
    },
    [config, message, isDismissed],
  );

  /*
   * Closes on unmatch — covering observed keystrokes and unobserved value
   * changes alike (prop sync, send-clear, history navigation) — and clears
   * the dismissal latch at the same time. Never opens: opening lives in
   * `handleValueChange` (typed bare prefix or command-shaped paste into an
   * empty textarea).
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
    dismiss,
    handleValueChange,
    listboxId,
    overlayRef,
    activeOptionId: isMenuOpen ? activeOptionId : null,
    moveActiveOption,
    getActiveOption,
  };
};
