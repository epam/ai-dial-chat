import { Message } from '../chat';

export interface SelectedConversationLoadedResponse {
  selectedConversationIds: string[];
}
export interface MessageCustomButtonResponse {
  eventName: keyof WindowEventMap;
  buttonKey: string;
  messageIndex: number;
}
export interface EditMessageResponse {
  editedMessage: Message;
  index: number;
  convId: string;
}
