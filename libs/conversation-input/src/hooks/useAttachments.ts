import {
  MAX_UPLOADS_PER_MINUTE,
  generateAttachmentId,
} from '@epam/ai-dial-attachment-input';
import type { Attachment } from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  AttachmentType,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { runAtRate } from '../utils/concurrency';

/** Parameters for the {@link useAttachments} hook. */
interface UseAttachmentsParams {
  /** Attachments pre-populated in the tray on mount. */
  initialAttachments: Attachment[];
  /** Called immediately after an attachment is added. Resolves with the uploaded URL. */
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  /** Called whenever the attachment list changes. */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  /**
   * Called synchronously for each new attachment before upload begins.
   * Return an `AttachmentErrorReason` to reject; return `undefined` to allow.
   */
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  /** Files dropped onto the parent awaiting processing. */
  pendingDropFiles: File[];
  /** Called after `pendingDropFiles` have been consumed. */
  onDropFilesConsumed?: () => void;
  /** Already-uploaded attachments supplied by the host awaiting insertion. */
  pendingAttachments: Attachment[];
  /** Called after `pendingAttachments` have been inserted. */
  onPendingAttachmentsConsumed?: () => void;
  /**
   * Called when a pasted-text attachment is expanded back into the textarea.
   * Receives the plain-text content of the attachment.
   */
  onExpandPastedText?: (text: string) => void;
  /** Maximum number of attachments allowed in the tray. Undefined means unlimited. */
  maximumAttachmentsAmount?: number;
  /** Attachments rendered outside this hook but counted against the same limit. */
  baseAttachmentsAmount?: number;
  /** Called when adding a batch would exceed `maximumAttachmentsAmount`. */
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
}

/** Return value of the {@link useAttachments} hook. */
export interface UseAttachmentsResult {
  /** Current attachment list. */
  attachments: Attachment[];
  /** Build `Attachment` objects from raw `File` instances (without uploading). */
  buildAttachments: (files: File[]) => Attachment[];
  /** Add attachments to the tray, uploading each one unless `upload` is `false`. */
  addAttachments: (newAttachments: Attachment[], upload?: boolean) => void;
  /** Override the attachment list entirely (used after send success/failure). */
  resetAttachments: (items: Attachment[]) => void;
  /** Remove a single attachment by id, revoking its preview URL if present. */
  handleRemove: (id: string) => void;
  /** Retry uploading a previously failed attachment. */
  handleRetry: (id: string) => void;
  /** Expand a pasted-text attachment back into the textarea. */
  handleExpand: (id: string) => Promise<void>;
  /** `true` when any attachment is still uploading or in an error state. */
  hasBlockedAttachments: boolean;
}

/**
 * Manages all attachment state and side-effects for the `Input` component:
 * building, uploading, adding, removing, retrying, expanding, and consuming
 * pending drop/attachment queues.
 */
export const useAttachments = ({
  initialAttachments,
  onUploadAttachment,
  onAttachmentsChange,
  validateAttachment,
  pendingDropFiles,
  onDropFilesConsumed,
  pendingAttachments,
  onPendingAttachmentsConsumed,
  onExpandPastedText,
  maximumAttachmentsAmount,
  baseAttachmentsAmount = 0,
  onAttachmentsLimitExceeded,
}: UseAttachmentsParams): UseAttachmentsResult => {
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        if (a.playUrl) URL.revokeObjectURL(a.playUrl);
      });
    };
  }, []);

  const buildAttachments = useCallback((files: File[]): Attachment[] => {
    return files.map((file) => {
      const isImage = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');
      const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
      const playUrl = isAudio ? URL.createObjectURL(file) : undefined;
      return {
        id: generateAttachmentId(),
        name: file.name,
        contentType: file.type,
        file,
        type: isImage
          ? AttachmentType.Image
          : isAudio
            ? AttachmentType.Audio
            : AttachmentType.File,
        status: RequestStatus.Idle,
        previewUrl,
        playUrl,
      };
    });
  }, []);

  const updateAttachments = useCallback(
    (updater: (current: Attachment[]) => Attachment[]) => {
      setAttachments((prev) => {
        const updated = updater(prev);
        if (updated !== prev) onAttachmentsChange?.(updated);
        return updated;
      });
    },
    [onAttachmentsChange],
  );

  const resetAttachments = useCallback(
    (items: Attachment[]) => {
      setAttachments(items);
      onAttachmentsChange?.(items);
    },
    [onAttachmentsChange],
  );

  const uploadAttachment = useCallback(
    async (attachment: Attachment) => {
      if (!onUploadAttachment) return;

      updateAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, status: RequestStatus.Loading }
            : item,
        ),
      );

      try {
        const url = await onUploadAttachment(attachment);
        updateAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? { ...item, status: RequestStatus.Idle, url }
              : item,
          ),
        );
      } catch (err) {
        const errorReason =
          err != null &&
          typeof err === 'object' &&
          'errorReason' in err &&
          Object.values(AttachmentErrorReason).includes(
            (err as { errorReason: AttachmentErrorReason }).errorReason,
          )
            ? (err as { errorReason: AttachmentErrorReason }).errorReason
            : undefined;
        updateAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  status: RequestStatus.Error,
                  ...(errorReason != null && { errorReason }),
                }
              : item,
          ),
        );
      }
    },
    [onUploadAttachment, updateAttachments],
  );

  const addAttachments = useCallback(
    (newAttachments: Attachment[], upload = true) => {
      /* Compute toAdd from the ref rather than inside the state updater.
       * React 18 StrictMode double-invokes updaters; a side-effect assignment
       * inside the updater would produce toAdd=[] on the second call (the
       * attachment is already in prev), causing runAtRate to receive an empty
       * array and skipping upload entirely. */
      const existingIds = new Set(attachmentsRef.current.map((a) => a.id));
      const toAdd = newAttachments.filter((a) => !existingIds.has(a.id));

      if (toAdd.length === 0) return;

      if (
        maximumAttachmentsAmount != null &&
        maximumAttachmentsAmount > 0 &&
        Number.isFinite(maximumAttachmentsAmount)
      ) {
        const count =
          baseAttachmentsAmount + attachmentsRef.current.length + toAdd.length;
        if (count > maximumAttachmentsAmount) {
          toAdd.forEach((attachment) => {
            if (attachment.previewUrl)
              URL.revokeObjectURL(attachment.previewUrl);
          });
          onAttachmentsLimitExceeded?.(count, maximumAttachmentsAmount);
          return;
        }
      }

      updateAttachments((prev) => [...prev, ...toAdd]);

      if (upload) {
        const validToUpload: Attachment[] = [];
        toAdd.forEach((attachment) => {
          const errorReason = validateAttachment?.(attachment);
          if (errorReason != null) {
            updateAttachments((current) =>
              current.map((item) =>
                item.id === attachment.id
                  ? { ...item, status: RequestStatus.Error, errorReason }
                  : item,
              ),
            );
          } else {
            validToUpload.push(attachment);
          }
        });
        void runAtRate(validToUpload, MAX_UPLOADS_PER_MINUTE, uploadAttachment);
      }
    },
    [
      baseAttachmentsAmount,
      maximumAttachmentsAmount,
      onAttachmentsLimitExceeded,
      updateAttachments,
      uploadAttachment,
      validateAttachment,
    ],
  );

  useEffect(() => {
    if (pendingDropFiles.length === 0) return;
    const built = buildAttachments(pendingDropFiles);
    addAttachments(built);
    onDropFilesConsumed?.();
  }, [addAttachments, buildAttachments, onDropFilesConsumed, pendingDropFiles]);

  useEffect(() => {
    if (pendingAttachments.length === 0) return;
    addAttachments(pendingAttachments, false);
    onPendingAttachmentsConsumed?.();
  }, [addAttachments, onPendingAttachmentsConsumed, pendingAttachments]);

  useEffect(() => {
    if (!validateAttachment) return;

    let changed = false;
    const toUpload: Attachment[] = [];
    const next = attachmentsRef.current.map((attachment) => {
      if (attachment.status === RequestStatus.Loading) return attachment;

      const errorReason = validateAttachment(attachment);
      if (errorReason != null) {
        if (
          attachment.status === RequestStatus.Error &&
          attachment.errorReason === errorReason
        ) {
          return attachment;
        }
        changed = true;
        return { ...attachment, status: RequestStatus.Error, errorReason };
      }

      if (attachment.errorReason === AttachmentErrorReason.UnsupportedType) {
        changed = true;
        const restored: Attachment = {
          ...attachment,
          status: RequestStatus.Idle,
          errorReason: undefined,
        };
        if (restored.url == null) toUpload.push(restored);
        return restored;
      }

      return attachment;
    });

    if (changed) updateAttachments(() => next);
    toUpload.forEach((attachment) => void uploadAttachment(attachment));
  }, [validateAttachment, updateAttachments, uploadAttachment]);

  const handleRemove = useCallback(
    (id: string) => {
      updateAttachments((prev) => {
        const target = prev.find((a) => a.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        if (target?.playUrl) URL.revokeObjectURL(target.playUrl);
        return prev.filter((a) => a.id !== id);
      });
    },
    [updateAttachments],
  );

  const handleRetry = useCallback(
    (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (!target) return;
      void uploadAttachment(target);
    },
    [attachments, uploadAttachment],
  );

  const handleExpand = useCallback(
    async (id: string) => {
      const target = attachments.find((a) => a.id === id);
      if (!target || target.type !== AttachmentType.Pasted) return;
      const text = await target.file.text();
      onExpandPastedText?.(text);
      handleRemove(id);
    },
    [attachments, handleRemove, onExpandPastedText],
  );

  const hasBlockedAttachments = attachments.some(
    (a) =>
      a.status === RequestStatus.Loading || a.status === RequestStatus.Error,
  );

  return {
    attachments,
    buildAttachments,
    addAttachments,
    resetAttachments,
    handleRemove,
    handleRetry,
    handleExpand,
    hasBlockedAttachments,
  };
};
