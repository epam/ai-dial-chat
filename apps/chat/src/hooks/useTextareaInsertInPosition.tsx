import { RefObject, useCallback } from 'react';

/**
 * Custom hook for inserting text at the cursor position in a textarea
 * @param textareaRef - Ref to the textarea element
 * @param text - The text to insert
 * @param setText - Function to set the text in the textarea
 * @returns An object with the insertTextAtCursor function and the getCursorPosition function
 */

export const useTextareaInsertInPosition = (
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  text: string,
  setText: (text: string) => void,
) => {
  const insertTextAtCursor = useCallback(
    (textToInsert: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;

      const beforeCursor = text.substring(0, startPos);
      const afterCursor = text.substring(endPos);
      const newText = beforeCursor + textToInsert + afterCursor;

      setText(newText);

      // Restore cursor position
      requestAnimationFrame(() => {
        const newCursorPos = startPos + textToInsert.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      });
    },
    [text, textareaRef, setText],
  );

  const getCursorPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return { start: 0, end: 0 };

    return {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }, [textareaRef]);

  return {
    insertTextAtCursor,
    getCursorPosition,
  };
};
