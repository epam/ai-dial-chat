import { useClipboardPaste } from '@epam/ai-dial-attachment-input';
import { type ClipboardEvent, useCallback } from 'react';
import type { useAttachments } from '../../../hooks/useAttachments';
import type { InputProps } from '../../../models/Input';

interface UsePasteHandlingParams {
  addAttachments: ReturnType<typeof useAttachments>['addAttachments'];
  isAttachmentsEnabled: boolean;
  isTextAttachmentsAllowed: boolean;
  pasteTextThreshold: number;
  maxMessageLength: number;
  onMessageTooLong: InputProps['onMessageTooLong'];
  commandMenu: InputProps['commandMenu'];
}

/**
 * The textarea's paste handler for `Input`: turns a long plain-text paste
 * into a `text/plain` attachment when the model accepts one, warns about a
 * paste that alone exceeds the message cap, and reports inline pasted text
 * to the command menu. Private to `Input`.
 */
export const usePasteHandling = ({
  addAttachments,
  isAttachmentsEnabled,
  isTextAttachmentsAllowed,
  pasteTextThreshold,
  maxMessageLength,
  onMessageTooLong,
  commandMenu,
}: UsePasteHandlingParams) => {
  /*
   * A long plain-text paste becomes a `text/plain` attachment only when the
   * selected model would accept one: `isAttachmentsEnabled` says attachments
   * are supported at all, `isTextAttachmentsAllowed` says a `text/plain`
   * attachment would pass the host's validation. On a model that accepts
   * only other kinds of attachments (e.g. images only), converting the paste
   * would produce an attachment the model rejects.
   */
  const isPasteAsAttachmentEnabled =
    isAttachmentsEnabled && isTextAttachmentsAllowed;
  const { handlePaste: handleClipboardPaste } = useClipboardPaste(
    addAttachments,
    isPasteAsAttachmentEnabled ? pasteTextThreshold : Infinity,
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      /*
       * Deliberately narrower than the send gate in `useSendKeyboard`. When a paste becomes
       * an attachment it never reaches the textarea, so warning here would be
       * about text the user did not paste inline; an under-threshold paste is
       * at most pasteTextThreshold characters and cannot reach the cap on its
       * own. Existing text plus a small paste crossing the cap is not visible
       * from the pasted string's length at all — the send gate catches that.
       */
      if (!isPasteAsAttachmentEnabled) {
        const text = e.clipboardData.getData('text/plain');
        if (text.length >= maxMessageLength) {
          onMessageTooLong?.(text.length, maxMessageLength);
        }
      }
      handleClipboardPaste(e);
      if (e.defaultPrevented) return;

      /* A textarea stores `\r\n` as `\n`, so the reported text must match what lands in `onChange`. */
      const pastedText = e.clipboardData
        .getData('text/plain')
        .replace(/\r\n?/g, '\n');
      if (pastedText !== '') commandMenu?.onTextPaste?.(pastedText);
    },
    [
      isPasteAsAttachmentEnabled,
      maxMessageLength,
      onMessageTooLong,
      handleClipboardPaste,
      commandMenu,
    ],
  );

  return handlePaste;
};
