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
  folderId: string;
  name: string;
  model: { id: string }; // TODO: add more model info
  prompt: string;
  temperature: number;
  messages: Message[];
  lastActivityDate: number;
  updatedAt: number;
  selectedAddons: string[];
  assistantModelId: string;
}
