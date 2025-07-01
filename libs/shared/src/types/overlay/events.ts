export interface SelectedConversationLoadedResponse {
  selectedConversationIds: string[];
}
export interface MessageCustomButtonResponse {
  eventName: keyof WindowEventMap;
  buttonKey: string;
  messageIndex: number;
}
