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

export interface Entity {
  entityId: string;
}

export interface ArithmeticRequestEntity extends Entity {
  isSysPromptAllowed?: boolean;
  systemPrompt?: string;
}

export interface EntityPlusAddonsRequest extends Entity {
  addonIds: string[];
  systemPrompt?: string;
  request: string;
  response: string;
}

export interface EntitySimpleRequest extends Entity {
  request: string;
  systemPrompt?: string;
  response?: string;
  isAttachmentResponse: boolean;
}

export interface EntityPlusAttachmentRequest extends Entity {
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
