import { ConversationInfo } from '../chat';

export type OverlayConversation = ConversationInfo & {
  bucket: string;
  parentPath?: string | null;
};
