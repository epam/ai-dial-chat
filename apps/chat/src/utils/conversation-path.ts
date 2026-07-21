import { safeDecodeURIComponent } from './string-utils';

export const getConversationPath = (conversationId: string): string => {
  const slashIndex = conversationId.indexOf('/');
  const path =
    slashIndex === -1
      ? conversationId
      : conversationId.substring(slashIndex + 1);
  return safeDecodeURIComponent(path);
};
