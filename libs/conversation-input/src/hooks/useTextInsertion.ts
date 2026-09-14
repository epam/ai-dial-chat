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
const applyValueThroughReact = (
  textarea: HTMLTextAreaElement,
  value: string,
  caret: number,
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

  textarea.setSelectionRange(caret, caret);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
};

/**
 * Inserts host-supplied text at the caret whenever `insertion.revision` changes,
 * leaving the rest of the draft intact.
 *
 * The insert goes through `execCommand('insertText')` rather than a React state
 * write, because only an edit made through the browser's editing pipeline lands on
 * the textarea's native undo stack. Writing the value from React instead is what let
 * a picked prompt discard an unrecoverable draft (issue #8754).
 */
export const useTextInsertion = ({
  insertion,
  textareaRef,
}: UseTextInsertionParams): void => {
  const revision = insertion?.revision;
  const textRef = useRef(insertion?.text);
  textRef.current = insertion?.text;
  /* Seeded with the revision present at mount so the first run is a no-op: an
     insertion already in flight when the input mounts (or remounts) has landed
     already, and replaying it would duplicate the text. */
  const lastRevisionRef = useRef(revision);

  useEffect(() => {
    if (revision === lastRevisionRef.current) return;
    lastRevisionRef.current = revision;

    const textarea = textareaRef.current;
    const text = textRef.current;
    if (!textarea || !text) return;

    /* Captured before focusing: the caret is where the user left it when they
       reached for the menu, and focusing can move it. */
    const { value, selectionStart, selectionEnd } = textarea;
    const start = selectionStart ?? value.length;
    const end = selectionEnd ?? start;

    textarea.focus();

    const isInsertedNatively =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, text);
    if (isInsertedNatively) return;

    applyValueThroughReact(
      textarea,
      `${value.slice(0, start)}${text}${value.slice(end)}`,
      start + text.length,
    );
  }, [revision, textareaRef]);
};
