import { Message } from '@/src/types/chat';

export const clearStateForMessages = (messages: Message[]): Message[] => {
  return messages.map((message) => ({
    ...message,
    custom_content: {
      ...message.custom_content,
      state: undefined,
    },
  }));
};
