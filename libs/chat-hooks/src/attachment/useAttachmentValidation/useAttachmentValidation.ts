import {
  isMimeTypeAllowed,
  mimeTypesToExtensionLabels,
} from '@epam/ai-dial-attachment-input';
import {
  AttachmentErrorReason,
  type Attachment,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { mimeTypesToFileAccept } from '../../files/attachment-types';

const DEFAULT_UNSUPPORTED_TYPE_DEBOUNCE_MS = 100;

/** Reason a rejected attachment failed validation. */
export enum AttachmentValidationErrorReason {
  /** No MIME types are allowed at all — attachments are disabled entirely. */
  NoTypesAllowed = 'noTypesAllowed',
  /** The attachment's content type is not among the allowed MIME types. */
  UnsupportedType = 'unsupportedType',
}

/** Structured, translation-free report of a rejected attachment, emitted at most once per debounce window. */
export interface AttachmentValidationErrorEvent {
  /** Why the attachment(s) were rejected. */
  reason: AttachmentValidationErrorReason;
  /** The resolved MIME types the caller currently allows (possibly empty). */
  allowedMimeTypes: string[];
  /** Already-formatted, non-translated extension list (e.g. ".png, .jpg"), present only when `reason` is `UnsupportedType`. */
  formats?: string;
}

/** Parameters for {@link useAttachmentValidation}. */
export interface UseAttachmentValidationParams {
  /** Resolved MIME types currently allowed for attachments. */
  allowedMimeTypes: string[];
  /** Called with a structured event when a rejected attachment is reported, at most once per debounce window. */
  onValidationError?: (event: AttachmentValidationErrorEvent) => void;
  /** Debounce window, in ms, before firing `onValidationError` for a rejected file. Defaults to `100`. */
  debounceMs?: number;
}

/** Return value of {@link useAttachmentValidation}. */
export interface UseAttachmentValidationResult {
  /** The resolved MIME types currently allowed for attachments (echoes the `allowedMimeTypes` param). */
  inputAttachmentTypes: string[];
  /** Whether at least one MIME type is currently allowed. */
  isAttachmentsAllowed: boolean;
  /** Classifies an attachment as allowed (`undefined`) or rejected (`AttachmentErrorReason`). */
  validateAttachment: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  /** `<input accept>` string derived from `allowedMimeTypes`, or `undefined` when any type accepts everything. */
  fileAccept: string | undefined;
}

/**
 * Validates an attachment's content type against a resolved list of allowed
 * MIME types, debouncing a burst of rejected files into a single
 * `onValidationError` call rather than firing one per file.
 */
export const useAttachmentValidation = ({
  allowedMimeTypes,
  onValidationError,
  debounceMs = DEFAULT_UNSUPPORTED_TYPE_DEBOUNCE_MS,
}: UseAttachmentValidationParams): UseAttachmentValidationResult => {
  const isAttachmentsAllowed = allowedMimeTypes.length > 0;

  const fileAccept = useMemo(
    () => mimeTypesToFileAccept(allowedMimeTypes),
    [allowedMimeTypes],
  );

  const unsupportedTypeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (unsupportedTypeTimerRef.current != null) {
        clearTimeout(unsupportedTypeTimerRef.current);
      }
    },
    [],
  );

  const validateAttachment = useCallback(
    (attachment: Attachment): AttachmentErrorReason | undefined => {
      if (!isMimeTypeAllowed(attachment.contentType, allowedMimeTypes)) {
        if (unsupportedTypeTimerRef.current != null) {
          clearTimeout(unsupportedTypeTimerRef.current);
        }
        unsupportedTypeTimerRef.current = setTimeout(() => {
          const noTypesAllowed = allowedMimeTypes.length === 0;
          onValidationError?.({
            reason: noTypesAllowed
              ? AttachmentValidationErrorReason.NoTypesAllowed
              : AttachmentValidationErrorReason.UnsupportedType,
            allowedMimeTypes,
            ...(noTypesAllowed
              ? {}
              : { formats: mimeTypesToExtensionLabels(allowedMimeTypes) }),
          });
          unsupportedTypeTimerRef.current = null;
        }, debounceMs);
        return AttachmentErrorReason.UnsupportedType;
      }
      return undefined;
    },
    [allowedMimeTypes, debounceMs, onValidationError],
  );

  return {
    inputAttachmentTypes: allowedMimeTypes,
    isAttachmentsAllowed,
    validateAttachment,
    fileAccept,
  };
};
