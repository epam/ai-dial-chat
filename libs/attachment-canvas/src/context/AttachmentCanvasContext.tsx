import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AttachmentCanvasContent } from '../models/attachment-canvas';
import { AttachmentContentType } from '../types/attachment-canvas';
import { getRevocableObjectUrl } from '../utils/content';

const EMPTY_CONTENT: AttachmentCanvasContent = {
  type: AttachmentContentType.PlainText,
  text: '',
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

const CanvasRequestContext = createContext<(() => () => boolean) | undefined>(
  undefined,
);

/** Provides attachment canvas state to all descendants. */
export const AttachmentCanvasProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const generation = useRef(0);
  const startRequest = useCallback(() => {
    const request = ++generation.current;
    return () => request === generation.current;
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
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
      <CanvasRequestContext.Provider value={startRequest}>
        {children}
      </CanvasRequestContext.Provider>
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

/** Starts a provider-scoped preview request, valid until superseded or the caller unmounts. */
export const useLatestCanvasRequest = (): (() => () => boolean) => {
  const startRequest = useContext(CanvasRequestContext);
  if (!startRequest)
    throw new Error(
      'useLatestCanvasRequest must be used within an AttachmentCanvasProvider',
    );
  const lifetime = useRef<object | undefined>(undefined);
  useEffect(() => {
    lifetime.current = {};
    return () => {
      lifetime.current = undefined;
    };
  }, []);
  return useCallback(() => {
    const currentLifetime = lifetime.current;
    const isLatest = startRequest();
    return () =>
      currentLifetime !== undefined &&
      lifetime.current === currentLifetime &&
      isLatest();
  }, [startRequest]);
};
