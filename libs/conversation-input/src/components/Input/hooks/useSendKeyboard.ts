import type { KeyboardEvent } from 'react';
import type { useAttachments } from '../../../hooks/useAttachments';
import type { useInputHistoryNavigation } from '../../../hooks/useInputHistoryNavigation';
import type { useMessageState } from '../../../hooks/useMessageState';
import {
  applyValueThroughReact,
  type UseTextInsertionResult,
} from '../../../hooks/useTextInsertion';
import type { InputProps } from '../../../models/Input';
import type { useCommandMenuController } from './useCommandMenuController';

type Attachments = ReturnType<typeof useAttachments>;

type CommandMenuController = ReturnType<typeof useCommandMenuController>;

interface UseSendKeyboardParams {
  message: string;
  setMessage: ReturnType<typeof useMessageState>['setMessage'];
  attachments: Attachments['attachments'];
  resetAttachments: Attachments['resetAttachments'];
  historyNav: ReturnType<typeof useInputHistoryNavigation>;
  onSend: InputProps['onSend'];
  onMessageTooLong: InputProps['onMessageTooLong'];
  maxMessageLength: number;
  isSendDisabled: boolean;
  isVoiceActive: boolean;
  isInputDisabled: boolean;
  isStreaming: boolean;
  canSend: boolean;
  hasModelSelected: boolean;
  handleUndoKeyDown: UseTextInsertionResult['handleUndoKeyDown'];
  handleCommandMenuKeyDown: CommandMenuController['handleCommandMenuKeyDown'];
  isSendGesture: CommandMenuController['isSendGesture'];
  onBackspaceAtCaret: InputProps['onBackspaceAtCaret'];
}

/**
 * Sending and the textarea's keyboard for `Input`: the send action with its
 * restore-on-failure, and `handleKeyDown`, which runs in order the pending
 * undo, the open command menu's keys, history navigation, the whole-mention
 * Backspace, and Enter-to-send. Private to `Input`.
 */
export const useSendKeyboard = ({
  message,
  setMessage,
  attachments,
  resetAttachments,
  historyNav,
  onSend,
  onMessageTooLong,
  maxMessageLength,
  isSendDisabled,
  isVoiceActive,
  isInputDisabled,
  isStreaming,
  canSend,
  hasModelSelected,
  handleUndoKeyDown,
  handleCommandMenuKeyDown,
  isSendGesture,
  onBackspaceAtCaret,
}: UseSendKeyboardParams) => {
  const handleSend = async () => {
    if (isSendDisabled || isVoiceActive) return;
    if (message.length >= maxMessageLength) {
      onMessageTooLong?.(message.length, maxMessageLength);
      return;
    }

    const currentMessage = message;
    const currentAttachments = attachments;
    setMessage('');
    historyNav.reset();
    try {
      await onSend?.(currentMessage, currentAttachments);
      currentAttachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        if (a.playUrl) URL.revokeObjectURL(a.playUrl);
      });
      resetAttachments([]);
    } catch {
      setMessage(currentMessage);
      resetAttachments(currentAttachments);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isVoiceActive) return;
    /* Serves the undo owed by an insertion the browser could not put on its own
     undo stack; a no-op whenever the browser can undo the edit itself. */
    if (handleUndoKeyDown(e)) return;
    if (handleCommandMenuKeyDown(e)) return;
    if (!e.nativeEvent.isComposing && !isInputDisabled && !isStreaming) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const cursorPos = e.currentTarget.selectionStart ?? 0;
        const newValue = historyNav.navigate(
          e.key === 'ArrowUp' ? 'up' : 'down',
          message,
          cursorPos,
        );
        if (newValue !== null) {
          e.preventDefault();
          setMessage(newValue);
          return;
        }
      }

      /*
       * The whole-mention remove gesture: a Backspace with the caret
       * collapsed exactly at a tracked range's trailing boundary deletes the
       * entire range in one native edit (so it lands on the browser's own
       * undo stack) instead of the default single-character deletion.
       */
      if (
        e.key === 'Backspace' &&
        onBackspaceAtCaret != null &&
        e.currentTarget.selectionStart === e.currentTarget.selectionEnd &&
        e.currentTarget.selectionStart != null
      ) {
        const range = onBackspaceAtCaret(e.currentTarget.selectionStart);
        if (range != null) {
          e.preventDefault();
          const textarea = e.currentTarget;
          textarea.setSelectionRange(range.start, range.start + range.length);
          const deletedNatively =
            typeof document.execCommand === 'function' &&
            document.execCommand('delete', false);
          if (!deletedNatively) {
            const nextValue =
              message.slice(0, range.start) +
              message.slice(range.start + range.length);
            applyValueThroughReact(textarea, nextValue, range.start);
          }
          return;
        }
      }
    }

    const isEnterKey = e.key === 'Enter';
    if (!isEnterKey) return;

    if (isSendGesture(e)) {
      e.preventDefault();
      if (!isStreaming && canSend && hasModelSelected && !isInputDisabled) {
        handleSend();
      }
    }
  };

  return { handleSend, handleKeyDown };
};
