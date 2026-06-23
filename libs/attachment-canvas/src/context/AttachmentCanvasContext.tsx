import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  AttachmentContentType,
  type AttachmentCanvasContent,
} from '../models/attachment-canvas';

const EMPTY_CONTENT: AttachmentCanvasContent = {
  type: AttachmentContentType.PlainText,
  text: '',
};

/** Value exposed by the attachment canvas context. */
export interface AttachmentCanvasContextValue {
  /** Whether the canvas panel is currently open. */
  isOpen: boolean;
  /** Content currently displayed in the canvas. */
  content: AttachmentCanvasContent;
  /** File name shown in the canvas header. */
  fileName: string | undefined;
  /** Open the canvas with the given content and optional file name. */
  openCanvas: (content: AttachmentCanvasContent, fileName?: string) => void;
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
  const [content, setContent] =
    useState<AttachmentCanvasContent>(EMPTY_CONTENT);
  const [fileName, setFileName] = useState<string | undefined>(undefined);

  const openCanvas = useCallback(
    (newContent: AttachmentCanvasContent, newFileName?: string) => {
      setContent(newContent);
      setFileName(newFileName);
      setIsOpen(true);
    },
    [],
  );

  const closeCanvas = useCallback(() => setIsOpen(false), []);

  return (
    <AttachmentCanvasContext.Provider
      value={useMemo(
        () => ({ isOpen, content, fileName, openCanvas, closeCanvas }),
        [isOpen, content, fileName, openCanvas, closeCanvas],
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
