export interface ConversationMetadata {
  name: string;
  author?: string;
  parentPath: string;
  bucket: string;
  url: string;
  nodeType: string;
  resourceType: string;
  etag?: string;
  createdAt?: number;
  updatedAt?: number;
  permissions?: string[];
}

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

export interface StreamChunkDelta {
  content?: string;
  role?: string;
}

export interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  choices: Array<{
    delta: StreamChunkDelta;
    finish_reason: string | null;
    index: number;
  }>;
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
