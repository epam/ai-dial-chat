import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { useCallback } from 'react';
import {
  downloadProjectFileAttachment,
  fromProjectOutputCardId,
  fromProjectPreviewKey,
  type ProjectFileDownloadUrlResolver,
  toProjectOutputCardId,
  toProjectPreviewKey,
} from './project-file-preview';

/** Tells whether the request that produced a result may still show it; `false` once a newer request superseded it. */
export type ProjectPreviewCommitGuard = () => boolean;

/** Opens an attachment in the host's canvas under a key, showing it only while the guard allows; the host's `openAttachmentCanvas` fits. */
export type OpenProjectPreviewAttachment = (
  attachment: DisplayAttachment,
  canvasAttachmentId: string,
  shouldCommit: ProjectPreviewCommitGuard,
) => unknown;

/** Host canvas operations and card lookups for the project file preview. */
export interface UseProjectFilePreviewOptions {
  /** Id of the project the page shows, or a fixed value before it exists; it keeps one file name in two projects apart. */
  scope: string;
  /** Id of the attachment the canvas holds now, or `undefined` when it is closed. */
  attachmentId: string | undefined;
  /** Opens an attachment in the canvas under a key. */
  openAttachment: OpenProjectPreviewAttachment;
  /** Closes the canvas. */
  closeCanvas: () => void;
  /** Starts a canvas request and returns the guard that says whether it is still the latest. */
  startRequest: () => ProjectPreviewCommitGuard;
  /** Returns the attachment to open for a context card id, or `undefined` for a card the page does not hold; it should keep its identity while the cards are unchanged. */
  resolveContextAttachment: (cardId: string) => DisplayAttachment | undefined;
  /** Returns the attachment to open for an output name; omit it where outputs are not shown. */
  resolveOutputAttachment?: (name: string) => DisplayAttachment | undefined;
  /** Resolves a stored file's locator to its download URL; when omitted, only files added in this session download. */
  resolveDownloadUrl?: ProjectFileDownloadUrlResolver;
}

/** Selection state and stable card callbacks of the project file preview. */
export interface UseProjectFilePreviewResult {
  /** Card id of the open project file, an output's card id included, or `undefined` when none of this scope is open. */
  selectedCardId: string | undefined;
  /** Card id of the open context file; `undefined` while an output or nothing is open. */
  selectedContextFileId: string | undefined;
  /** Name of the open output; `undefined` while a context file or nothing is open. */
  selectedOutputName: string | undefined;
  /** Opens a context card, or closes the canvas when that card is already open. */
  onContextFileClick: (cardId: string) => void;
  /** Opens an output, or closes the canvas when that output is already open. */
  onOutputClick: (name: string) => void;
  /** Downloads a context card's file without opening it in the canvas. */
  onContextFileDownload: (cardId: string) => void;
  /** Closes the canvas when the open context card is no longer among the page's cards. */
  closeIfRemoved: (cards: readonly { id: string }[]) => void;
}

/** Opens project files in the host's attachment canvas for the New project, Edit project and project view pages, deriving the selected card from the canvas. */
export const useProjectFilePreview = ({
  scope,
  attachmentId,
  openAttachment,
  closeCanvas,
  startRequest,
  resolveContextAttachment,
  resolveOutputAttachment,
  resolveDownloadUrl,
}: UseProjectFilePreviewOptions): UseProjectFilePreviewResult => {
  const selectedCardId = fromProjectPreviewKey(scope, attachmentId);
  /* An output's card id is `artifacts/{name}`, which no context file name can match. */
  const selectedOutputName = fromProjectOutputCardId(selectedCardId);
  const selectedContextFileId =
    selectedOutputName == null ? selectedCardId : undefined;

  const onContextFileClick = useCallback(
    (cardId: string) => {
      /* The open file's card closes the canvas, as its pressed state says. */
      if (cardId === selectedContextFileId) {
        closeCanvas();
        return;
      }
      const attachment = resolveContextAttachment(cardId);
      if (!attachment) return;
      void openAttachment(
        attachment,
        toProjectPreviewKey(scope, cardId),
        startRequest(),
      );
    },
    [
      closeCanvas,
      openAttachment,
      resolveContextAttachment,
      scope,
      selectedContextFileId,
      startRequest,
    ],
  );

  const onOutputClick = useCallback(
    (name: string) => {
      if (name === selectedOutputName) {
        closeCanvas();
        return;
      }
      const attachment = resolveOutputAttachment?.(name);
      if (!attachment) return;
      void openAttachment(
        attachment,
        toProjectPreviewKey(scope, toProjectOutputCardId(name)),
        startRequest(),
      );
    },
    [
      closeCanvas,
      openAttachment,
      resolveOutputAttachment,
      scope,
      selectedOutputName,
      startRequest,
    ],
  );

  const onContextFileDownload = useCallback(
    (cardId: string) => {
      const attachment = resolveContextAttachment(cardId);
      if (!attachment) return;
      downloadProjectFileAttachment(attachment, resolveDownloadUrl);
    },
    [resolveContextAttachment, resolveDownloadUrl],
  );

  const closeIfRemoved = useCallback(
    (cards: readonly { id: string }[]) => {
      /* Removing the file the canvas shows closes it. */
      if (
        selectedContextFileId != null &&
        !cards.some((card) => card.id === selectedContextFileId)
      ) {
        closeCanvas();
      }
    },
    [closeCanvas, selectedContextFileId],
  );

  return {
    selectedCardId,
    selectedContextFileId,
    selectedOutputName,
    onContextFileClick,
    onOutputClick,
    onContextFileDownload,
    closeIfRemoved,
  };
};
