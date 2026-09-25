import { useEffect, useRef, type RefObject } from 'react';
import type { TextInsertion } from '../models/Input';

/** Parameters for the {@link useTextInsertion} hook. */
interface UseTextInsertionParams {
  /** One-shot hand-off; a change of its `revision` performs the insertion. */
  insertion?: TextInsertion;
  /** Ref attached to the `<textarea>` receiving the text. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * Writes `value` into the textarea through React's own value tracker and fires the
 * `input` event React listens for, so the component's `onChange` runs exactly as it
 * does for a keystroke. Used only where the browser cannot perform the edit itself.
 */
export const applyValueThroughReact = (
  textarea: HTMLTextAreaElement,
  value: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): void => {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  /* Assigning `textarea.value` directly is swallowed: React's value tracker sees the
     node already holding the new string and suppresses the change. The prototype
     setter bypasses the tracker's patched property. */
  if (nativeValueSetter) {
    nativeValueSetter.call(textarea, value);
  } else {
    textarea.value = value;
  }

  textarea.setSelectionRange(selectionStart, selectionEnd);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * Snapshot of the draft as it stood before an insertion that the browser cannot
 * undo on its own, so `Ctrl`/`Cmd`+`Z` can still restore it.
 */
interface UndoSnapshot {
  /** Value the insertion produced; the snapshot is stale once the textarea holds anything else. */
  insertedValue: string;
  /** Draft to restore. */
  previousValue: string;
  /** Selection to restore with the draft. */
  previousSelectionStart: number;
  /** Selection to restore with the draft. */
  previousSelectionEnd: number;
}

const isUndoShortcut = (event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean =>
  event.key.toLowerCase() === 'z' &&
  (event.ctrlKey || event.metaKey) &&
  !event.shiftKey &&
  !event.altKey;

/** Return value of the {@link useTextInsertion} hook. */
export interface UseTextInsertionResult {
  /**
   * Call from the textarea's `keydown`. Returns `true` when it has handled an
   * undo the browser could not, in which case the caller must stop processing
   * the event; `false` leaves the browser's own undo untouched.
   */
  handleUndoKeyDown: (event: {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    preventDefault: () => void;
  }) => boolean;
}

/**
 * Inserts host-supplied text at the caret whenever `insertion.revision` changes,
 * leaving the rest of the draft intact and undoable with `Ctrl`/`Cmd`+`Z`.
 *
 * The insert goes through `execCommand('insertText')` rather than a React state
 * write, because only an edit made through the browser's editing pipeline lands on
 * the textarea's native undo stack. Writing the value from React instead is what let
 * a picked prompt discard an unrecoverable draft (issue #8754).
 */
export const useTextInsertion = ({
  insertion,
  textareaRef,
}: UseTextInsertionParams): UseTextInsertionResult => {
  const revision = insertion?.revision;
  const textRef = useRef(insertion?.text);
  textRef.current = insertion?.text;
  /* Seeded with the revision present at mount so the first run is a no-op: an
     insertion already in flight when the input mounts (or remounts) has landed
     already, and replaying it would duplicate the text. */
  const lastRevisionRef = useRef(revision);
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);

  useEffect(() => {
    if (revision === lastRevisionRef.current) return;
    lastRevisionRef.current = revision;

    const text = textRef.current;
    if (!textareaRef.current || !text) return;

    /*
     * Deferred out of the commit that asked for the insertion, for two reasons
     * (issue #8781):
     *
     * - `execCommand` dispatches `input` synchronously. Mid-commit React cannot
     *   flush that update synchronously, so it restores the textarea's value
     *   from the props it is currently rendering and writes the new one on the
     *   next render. That write is programmatic, and a programmatic write clears
     *   the browser's undo history — taking the entry the insert just created
     *   with it, which left `Ctrl`+`Z` with nothing to undo, not even the text
     *   the user had typed by hand.
     * - The menu or modal the prompt was picked in returns focus to its own
     *   opener from a microtask queued as it unmounted, which pulled the caret
     *   out of the composer right after the insert — so the undo shortcut never
     *   reached the textarea either.
     *
     * A microtask runs after both: the edit then lands on a settled DOM as an
     * ordinary user edit, and the caret stays after the inserted text.
     */
    queueMicrotask(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { value, selectionStart, selectionEnd } = textarea;
      const start = selectionStart ?? value.length;
      const end = selectionEnd ?? start;

      textarea.focus();

      /* A fresh insertion supersedes any snapshot the previous one left behind. */
      undoSnapshotRef.current = null;

      const isInsertedNatively =
        typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, text);
      if (isInsertedNatively) return;

      const insertedValue = `${value.slice(0, start)}${text}${value.slice(end)}`;
      applyValueThroughReact(textarea, insertedValue, start + text.length);

      /*
       * Browsers without `insertText` on a textarea (Firefox) only take the
       * value programmatically, which wipes their undo history — so the undo
       * this insert owes the user is served from here instead. Recorded after
       * the write, whose `input` event is dispatched synchronously, so the
       * snapshot describes the value the textarea ends up holding.
       */
      undoSnapshotRef.current = {
        insertedValue,
        previousValue: value,
        previousSelectionStart: start,
        previousSelectionEnd: end,
      };
    });
  }, [revision, textareaRef]);

  const handleUndoKeyDown: UseTextInsertionResult['handleUndoKeyDown'] = (
    event,
  ) => {
    const snapshot = undoSnapshotRef.current;
    const textarea = textareaRef.current;
    if (snapshot == null || textarea == null || !isUndoShortcut(event)) {
      return false;
    }

    undoSnapshotRef.current = null;

    /* Edits made after the insertion have given the browser an undo history of
       its own; undoing those is its job, not ours. */
    if (textarea.value !== snapshot.insertedValue) return false;

    event.preventDefault();
    applyValueThroughReact(
      textarea,
      snapshot.previousValue,
      snapshot.previousSelectionStart,
      snapshot.previousSelectionEnd,
    );
    return true;
  };

  return { handleUndoKeyDown };
};
