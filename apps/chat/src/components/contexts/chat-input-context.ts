import { RefObject, createContext, createRef, useContext } from 'react';

export const ChatInputContext = createContext<{
  chatInputRef: RefObject<HTMLTextAreaElement | null>;
  focusChatInput: () => void;
}>({
  chatInputRef: createRef(),
  focusChatInput: () => undefined,
});

export const useChatInputContext = () => useContext(ChatInputContext);
