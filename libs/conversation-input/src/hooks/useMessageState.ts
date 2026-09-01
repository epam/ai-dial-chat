import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

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
}

/** Manages the textarea value for the `Input` component. */
export const useMessageState = ({
  messageProp,
  messageRevision,
}: UseMessageStateParams): UseMessageStateResult => {
  const [message, setMessage] = useState(messageProp);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessage(messageProp);
  }, [messageProp, messageRevision]);

  return { message, setMessage, textareaRef };
};
