export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  messages: Message[];
  createdAt: string;
}
