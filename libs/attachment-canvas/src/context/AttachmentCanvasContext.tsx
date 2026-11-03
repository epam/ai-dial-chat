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
  /** Open the canvas with the given content and optional file name; `onRetry` re-opens it from a load error. */
  openCanvas: (
    content: AttachmentCanvasContent,
    fileName?: string,
    attachmentId?: string,
    onRetry?: () => void,
  ) => void;
  /** Close the canvas. */
  closeCanvas: () => void;
  /** Re-opens the current attachment after a load error; unset when the opener gave no retry. */
  retryCanvas: (() => void) | undefined;
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
  const [retryCanvas, setRetryCanvas] = useState<(() => void) | undefined>(
    undefined,
  );

  const openCanvasLoading = useCallback(
    (newFileName?: string, newAttachmentId?: string) => {
      setFileName(newFileName);
      setAttachmentId(newAttachmentId);
      setRetryCanvas(undefined);
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
      onRetry?: () => void,
    ) => {
      setContent(newContent);
      setFileName(newFileName);
      setAttachmentId(newAttachmentId);
      /* A function state value must be wrapped, or React calls it as an updater. */
      setRetryCanvas(onRetry == null ? undefined : () => onRetry);
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
    setRetryCanvas(undefined);
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
          retryCanvas,
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
          retryCanvas,
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

/** The provider's request starter, or `undefined` outside a provider; for library hooks that must not throw. */
export const useCanvasRequestStarter = (): (() => () => boolean) | undefined =>
  useContext(CanvasRequestContext);

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
