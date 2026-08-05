import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import { AttachmentContentType } from '../types/attachment-canvas';

const EMPTY_CONTENT: AttachmentCanvasContent = {
  type: AttachmentContentType.PlainText,
  text: '',
};

/**
 * Returns `content.url` when it is an object URL created by
 * `URL.createObjectURL` (i.e. it should be revoked once no longer displayed),
 * or `undefined` otherwise (a remote/data URL, or a content type with no
 * `url` at all).
 */
const getRevocableObjectUrl = (
  content: AttachmentCanvasContent,
): string | undefined => {
  if (
    content.type !== AttachmentContentType.Image &&
    content.type !== AttachmentContentType.Audio &&
    content.type !== AttachmentContentType.Pdf
  ) {
    return undefined;
  }
  return content.url.startsWith('blob:') ? content.url : undefined;
};

/** Value exposed by the attachment canvas context. */
export interface AttachmentCanvasContextValue {
  /** Whether the canvas panel is currently open. */
  isOpen: boolean;
  /** Whether the panel is open but content is still being resolved (shows a spinner). */
  isLoading: boolean;
  /** Content currently displayed in the canvas. */
  content: AttachmentCanvasContent;
  /** File name shown in the canvas header. */
  fileName: string | undefined;
  /** ID of the attachment currently displayed in the canvas, if any. */
  attachmentId: string | undefined;
  /** Open the canvas immediately in a loading state before content has resolved. */
  openCanvasLoading: (fileName?: string, attachmentId?: string) => void;
  /** Open the canvas with the given content and optional file name. */
  openCanvas: (
    content: AttachmentCanvasContent,
    fileName?: string,
    attachmentId?: string,
  ) => void;
  /** Close the canvas. */
  closeCanvas: () => void;
}

const AttachmentCanvasContext = createContext<
  AttachmentCanvasContextValue | undefined
>(undefined);
AttachmentCanvasContext.displayName = 'AttachmentCanvasContext';

/** Provides attachment canvas state to all descendants. */
export const AttachmentCanvasProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] =
    useState<AttachmentCanvasContent>(EMPTY_CONTENT);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [attachmentId, setAttachmentId] = useState<string | undefined>(
    undefined,
  );

  const openCanvasLoading = useCallback(
    (newFileName?: string, newAttachmentId?: string) => {
      setFileName(newFileName);
      setAttachmentId(newAttachmentId);
      setIsLoading(true);
      setIsOpen(true);
    },
    [],
  );

  const openCanvas = useCallback(
    (
      newContent: AttachmentCanvasContent,
      newFileName?: string,
      newAttachmentId?: string,
    ) => {
      setContent(newContent);
      setFileName(newFileName);
      setAttachmentId(newAttachmentId);
      setIsLoading(false);
      setIsOpen(true);
    },
    [],
  );

  const closeCanvas = useCallback(() => {
    setContent(EMPTY_CONTENT);
    setIsOpen(false);
    setIsLoading(false);
    setAttachmentId(undefined);
  }, []);

  /* Revokes the outgoing content's object URL whenever it is replaced by new
   * content, and on unmount — otherwise every opened image/PDF blob URL leaks
   * for the lifetime of the page. */
  useEffect(() => {
    return () => {
      const url = getRevocableObjectUrl(content);
      if (url != null) URL.revokeObjectURL(url);
    };
  }, [content]);

  return (
    <AttachmentCanvasContext.Provider
      value={useMemo(
        () => ({
          isOpen,
          isLoading,
          content,
          fileName,
          attachmentId,
          openCanvasLoading,
          openCanvas,
          closeCanvas,
        }),
        [
          isOpen,
          isLoading,
          content,
          fileName,
          attachmentId,
          openCanvasLoading,
          openCanvas,
          closeCanvas,
        ],
      )}
    >
      {children}
    </AttachmentCanvasContext.Provider>
  );
};

/** Consumes the attachment canvas context. Must be used inside `AttachmentCanvasProvider`. */
export const useAttachmentCanvas = (): AttachmentCanvasContextValue => {
  const value = useContext(AttachmentCanvasContext);
  if (!value) {
    throw new Error(
      'useAttachmentCanvas must be used within an AttachmentCanvasProvider',
    );
  }
  return value;
};
