import {
  Dispatch,
  SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/** Parameters for the {@link useMessageState} hook. */
interface UseMessageStateParams {
  /** Message value supplied by the parent. */
  messageProp: string;
  /** Optional token that forces resync even when the message value is unchanged. */
  messageRevision?: number;
}

/** Return value of the {@link useMessageState} hook. */
export interface UseMessageStateResult {
  /** Current textarea value. */
  message: string;
  /** Update the local message value. */
  setMessage: Dispatch<SetStateAction<string>>;
  /** Ref attached to the `<textarea>` element. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** `true` when the textarea content spans more than one visual line. */
  isMultiLine: boolean;
}

/** Manages textarea value and multi-line state for the `Input` component. */
export const useMessageState = ({
  messageProp,
  messageRevision,
}: UseMessageStateParams): UseMessageStateResult => {
  const [message, setMessage] = useState(messageProp);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const singleRowHeightRef = useRef<number>(0);
  const [isMultiLine, setIsMultiLine] = useState(false);

  useEffect(() => {
    setMessage(messageProp);
  }, [messageProp, messageRevision]);

  useEffect(() => {
    if (textareaRef.current) {
      singleRowHeightRef.current = textareaRef.current.offsetHeight;
    }
  }, []);

  useLayoutEffect(() => {
    if (!textareaRef.current || singleRowHeightRef.current === 0) return;
    const isNowMultiLine =
      textareaRef.current.offsetHeight > singleRowHeightRef.current;
    /*
     * Only reset to false when message is empty: switching from stacked to non-stacked
     * changes textarea width, which can re-trigger wrapping and cause an infinite toggle.
     */
    setIsMultiLine((prev) =>
      isNowMultiLine ? true : message === '' ? false : prev,
    );
  }, [message]);

  return { message, setMessage, textareaRef, isMultiLine };
};
