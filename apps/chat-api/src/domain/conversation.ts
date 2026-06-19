export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  Status = 'status',
}

export enum StatusEvent {
  ModelChanged = 'model_changed',
}

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

export interface MessageAttachment {
  index?: number;
  type?: string;
  title: string;
  data?: string;
  url?: string;
  reference_type?: string;
  reference_url?: string;
}

export interface MessageCustomContent {
  attachments?: MessageAttachment[];
  form_value?: Record<string, number | string | boolean | string[] | undefined>;
  configuration_value?: Record<string, unknown>;
  stages?: unknown[];
}

export interface Message {
  role: MessageRole;
  content: string;
  timestamp: string;
  custom_content?: MessageCustomContent;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  folderId: string;
  name: string;
  model: { id: string };
  prompt: string;
  temperature: number;
  messages: Message[];
  lastActivityDate: number;
  updatedAt: number;
  selectedAddons: string[];
  assistantModelId: string;
}
