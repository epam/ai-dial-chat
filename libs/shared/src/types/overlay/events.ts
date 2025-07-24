import { Message } from '../chat';

export interface SelectedConversationLoadedEventResponse {
  selectedConversationIds: string[];
}
export interface MessageCustomButtonEventResponse {
  eventName: keyof WindowEventMap;
  buttonKey: string;
  messageIndex: number;
}
export interface EditMessageEventResponse {
  editedMessage: Message;
  index: number;
  convId: string;
}
export interface DeleteMessageEventResponse {
  index: number;
}
