export interface TreeEntity {
  name: string;
  index?: number;
}

export type ElementState = 'visible' | 'hidden';

export type ElementCaretState = 'expanded' | 'collapsed';

export type ElementLabel = 'more' | 'less';

export enum EntityType {
  Conversation,
  Prompt,
}
export enum CollapsedSections {
  Organization = 'Organization',
}

export interface ArithmeticRequestEntity {
  entityId: string;
  isSysPromptAllowed?: boolean;
  systemPrompt?: string;
}

export interface EntityPlusAddonsRequest {
  entityId: string;
  addonIds: string[];
  systemPrompt?: string;
  request: string;
  response: string;
}

export interface EntitySimpleRequest {
  entityId: string;
  request: string;
  systemPrompt?: string;
  response?: string;
  isAttachmentResponse: boolean;
}

export interface EntityPlusAttachmentRequest {
  entityId: string;
  attachmentName: string;
  systemPrompt?: string;
  request?: string;
  response: string;
}

export interface AssistantPlusAddonsRequest {
  assistantId: string;
  addonIds: string[];
  assistantModelId: string;
  request: string;
  response: string;
}
