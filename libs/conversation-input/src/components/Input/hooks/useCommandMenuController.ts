import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react';
import {
  CommandMenuOptionStep,
  useCommandMenu,
} from '../../../hooks/useCommandMenu/useCommandMenu';
import type { useInputHistoryNavigation } from '../../../hooks/useInputHistoryNavigation';
import type { useMessageState } from '../../../hooks/useMessageState';
import { type InputProps, SendOnEnter } from '../../../models/Input';

interface UseCommandMenuControllerParams {
  commandMenu: InputProps['commandMenu'];
  message: string;
  setMessage: ReturnType<typeof useMessageState>['setMessage'];
  textareaRef: ReturnType<typeof useMessageState>['textareaRef'];
  historyNav: ReturnType<typeof useInputHistoryNavigation>;
  onChange: ((message: string) => void) | undefined;
  caretPositionOverride: number | undefined;
  messageRevision: number | undefined;
  /* From `useTextInsertion`: records that the caret was placed programmatically. */
  markCaretPlaced: () => void;
  sendOnEnter: SendOnEnter;
}

/**
 * The `/command` menu wiring of `Input`: re-evaluates the menu when the caret
 * moves, derives the empty-query hint and the popup's marker offset, consumes
 * the `/query` text on selection, restores a host-driven caret, and owns the
 * keys an open menu takes. Returns `skipFocusMenuEvaluationRef`, which
 * `useVoiceInput` sets when it restores focus after recording. Private to
 * `Input`.
 */
export const useCommandMenuController = ({
  commandMenu,
  message,
  setMessage,
  textareaRef,
  historyNav,
  onChange,
  caretPositionOverride,
  messageRevision,
  markCaretPlaced,
  sendOnEnter,
}: UseCommandMenuControllerParams) => {
  const {
    isMenuOpen,
    query,
    activeWordStart,
    dismiss,
    closeOnOutsidePress,
    handleCaretMove: handleCommandMenuCaretMove,
    handleValueChange,
    listboxId: commandMenuListboxId,
    overlayRef: commandMenuOverlayRef,
    activeOptionId: activeCommandOptionId,
    moveActiveOption: moveActiveCommandOption,
    getActiveOption: getActiveCommandOption,
  } = useCommandMenu({
    config: commandMenu,
    message,
  });

  /*
   * `handleCommandMenuCaretMove` evaluates the word at a given caret
   * position, so it needs that position resolved. A mouse click's own
   * caret is already resolved by the time React's `onClick` fires, but the
   * `focus` event that precedes it can fire before the browser has placed
   * the caret — reading `selectionStart` there is unreliable across
   * browsers — so `onFocus` defers one frame, by when it always has.
   *
   * The deferred call goes through a ref to the latest handler: an edit
   * landing inside that frame (a paste right after focusing) re-renders
   * with a new message, and the focus-time handler would evaluate the
   * caret against the stale one and close a menu the edit just opened.
   */
  const latestCommandMenuCaretMoveRef = useRef(handleCommandMenuCaretMove);
  latestCommandMenuCaretMoveRef.current = handleCommandMenuCaretMove;
  const handleTextareaClick = () => {
    handleCommandMenuCaretMove(
      textareaRef.current?.selectionStart ?? message.length,
    );
  };
  const skipFocusMenuEvaluationRef = useRef(false);
  const handleTextareaFocus = () => {
    if (skipFocusMenuEvaluationRef.current) {
      skipFocusMenuEvaluationRef.current = false;
      return;
    }
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      latestCommandMenuCaretMoveRef.current(
        textarea?.selectionStart ?? textarea?.value.length ?? 0,
      );
    });
  };

  /*
   * Keyboard caret movement (Left/Right/Home/End/PageUp/PageDown) needs the
   * same re-evaluation as a click, since it can carry the caret into or out
   * of a command-shaped word with no `onChange` — the keys the command menu
   * itself consumes for navigation (ArrowUp/ArrowDown/Enter, only while it's
   * already open, see `handleCommandMenuKeyDown`) are excluded so this never
   * double-processes those. `keyup`, not `keydown`, because the browser has
   * already moved the caret to its new position by then.
   */
  const handleTextareaKeyUp = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'Home' &&
      e.key !== 'End' &&
      e.key !== 'PageUp' &&
      e.key !== 'PageDown'
    ) {
      return;
    }
    handleCommandMenuCaretMove(
      e.currentTarget.selectionStart ?? message.length,
    );
  };

  /*
   * The command menu's empty-query hint: while the menu is open the value is
   * the trigger prefix plus the query, so an empty query means the textarea
   * holds exactly the prefix — the hint renders right after it and disappears
   * with the first query keystroke. This gates only the hint content itself:
   * the textarea's wrapper below is driven by the hint's *configuration*, not
   * the live menu state, so the hint appearing and disappearing never
   * remounts the textarea mid-typing.
   *
   * The hint is spliced in as real inline content of the highlight mirror
   * (see `insertions` below), not a separately-positioned overlay, so it
   * never pushes real text out of the way — anything after the trigger on
   * the *same line* would sit right after the hint and read as one run, so
   * the hint is suppressed whenever the line the trigger is on has more
   * text after it — content on a later line is unaffected, since the hint
   * never extends past its own line.
   */
  const hasCommandHintConfigured = commandMenu?.emptyQueryHint != null;
  const triggerEnd =
    commandMenu != null && activeWordStart != null
      ? activeWordStart + commandMenu.triggerPrefix.length
      : null;
  const hasContentAfterTriggerOnLine =
    triggerEnd != null && message.slice(triggerEnd).split('\n', 1)[0] !== '';
  const hasCommandEmptyQueryHint =
    hasCommandHintConfigured &&
    isMenuOpen &&
    query === '' &&
    triggerEnd != null &&
    !hasContentAfterTriggerOnLine;

  /*
   * The command menu's trigger word can sit anywhere in the message, not
   * only at its very start, so the popup must be positioned at that word's
   * actual on-screen location rather than a fixed corner. `markerOffset` is
   * that word's character offset whenever the menu is open; a zero-size
   * marker `<span>` is spliced into the invisible mention-highlight mirror
   * at that offset (`insertions` below), and its measured position becomes
   * the pixel anchor the popup's wrapper div positions itself at. The
   * empty-query hint does not need this: it renders as real inline content
   * of the same mirror, so it inherits the exact line position for free.
   */
  const markerOffset =
    commandMenu != null && isMenuOpen ? (activeWordStart ?? 0) : null;

  /*
   * Selection path of the command menu: removes the `/query` text from the
   * textarea so it is never sent, resets the draft-history state to match,
   * and notifies the host. The consume lives here because the textarea value
   * is owned by this component — a host-side removal would race the lib.
   */
  const handleCloseCommandMenu = useCallback(
    (options?: { consumeQuery?: boolean; returnFocus?: boolean }) => {
      if (commandMenu == null) return;

      dismiss();
      if (!options?.consumeQuery) return;

      /* Return focus to the textarea (skipped for `returnFocus: false` — see the `commandMenu` doc on `close`). */
      if (options.returnFocus !== false) textareaRef.current?.focus();

      if (activeWordStart == null) return;

      const consumed = `${commandMenu.triggerPrefix}${query}`;
      const consumedEnd = activeWordStart + consumed.length;
      if (message.slice(activeWordStart, consumedEnd) !== consumed) return;

      const nextMessage =
        message.slice(0, activeWordStart) + message.slice(consumedEnd);
      setMessage(nextMessage);
      historyNav.notifyChange();
      onChange?.(nextMessage);
    },
    [
      commandMenu,
      dismiss,
      query,
      message,
      activeWordStart,
      setMessage,
      historyNav,
      onChange,
      textareaRef,
    ],
  );

  /*
   * Places the caret once per host-driven resync (e.g. right after the host
   * pushes a new `message` that spliced in a mention at a known position),
   * so the user can keep typing from exactly where the inserted text ends
   * rather than wherever the browser defaults the caret to after a
   * programmatic value change. Keyed on `message` (the state `useMessageState`
   * actually resyncs, not `messageRevision` itself): a prop change and its
   * resulting `setMessage` call land in two separate commits, and assigning
   * `.value` on that later commit resets the caret — this effect must run
   * after that assignment, not alongside the prop-change commit that
   * precedes it. `revisionRef` applies the override once per bump so it
   * doesn't refire on every ordinary keystroke.
   */
  const appliedCaretRevisionRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      caretPositionOverride == null ||
      appliedCaretRevisionRef.current === messageRevision
    ) {
      return;
    }
    appliedCaretRevisionRef.current = messageRevision;
    textareaRef.current?.setSelectionRange(
      caretPositionOverride,
      caretPositionOverride,
    );
    markCaretPlaced();
    /* Re-evaluates the command menu for this new caret position — a programmatic restore can land the caret back in a matching `/word`. */
    handleCommandMenuCaretMove(caretPositionOverride);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  const isSendGesture = (e: KeyboardEvent<HTMLTextAreaElement>) =>
    sendOnEnter === SendOnEnter.MetaEnter
      ? (e.metaKey || e.ctrlKey) && !e.shiftKey
      : !e.shiftKey && !e.metaKey && !e.ctrlKey;

  /*
   * The open command menu behaves as a list autocomplete, so it takes the
   * keys an autocomplete owns before the textarea's own handling: the
   * arrows move the active option instead of navigating message history
   * (the trigger word is single-line, so there is no line to move to), and
   * Enter takes the active option instead of sending the message — with no
   * option active it does nothing rather than send. Shift+Enter and, in
   * MetaEnter mode, a bare Enter with nothing active keep inserting a
   * newline, which closes the menu. Escape is handled here, not left to the
   * `Dropdown`'s own floating-ui dismissal, so it can call the latching
   * `dismiss()` and stop the event before it also reaches floating-ui's
   * listener and gets folded into the *non*-latching outside-press path
   * (`onOpenChange` below). Returns whether the key was consumed.
   */
  const handleCommandMenuKeyDown = (
    e: KeyboardEvent<HTMLTextAreaElement>,
  ): boolean => {
    if (!isMenuOpen || e.nativeEvent.isComposing) return false;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dismiss();
      return true;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveActiveCommandOption(
        e.key === 'ArrowDown'
          ? CommandMenuOptionStep.Next
          : CommandMenuOptionStep.Previous,
      );
      return true;
    }

    if (e.key !== 'Enter' || e.shiftKey) return false;

    const activeOption = getActiveCommandOption();
    if (activeOption != null) {
      e.preventDefault();
      activeOption.click();
      return true;
    }

    if (isSendGesture(e)) {
      e.preventDefault();
      return true;
    }

    return false;
  };

  return {
    isMenuOpen,
    query,
    activeWordStart,
    closeOnOutsidePress,
    handleValueChange,
    commandMenuListboxId,
    commandMenuOverlayRef,
    activeCommandOptionId,
    handleTextareaClick,
    handleTextareaFocus,
    handleTextareaKeyUp,
    skipFocusMenuEvaluationRef,
    triggerEnd,
    hasCommandEmptyQueryHint,
    markerOffset,
    handleCloseCommandMenu,
    isSendGesture,
    handleCommandMenuKeyDown,
  };
};
