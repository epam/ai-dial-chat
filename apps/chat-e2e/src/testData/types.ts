export interface TreeEntity {
  name: string;
  index?: number;
}

export type ElementState = 'visible' | 'hidden';

export type ElementCaretState = 'expanded' | 'collapsed';

export type ElementLabel = 'more' | 'less';

export interface ArithmeticRequestEntity {
  entityId: string;
  isSysPromptAllowed?: boolean;
}

export interface EntityPlusAddonsRequest {
  entityId: string;
  addonIds: string[];
  request: string;
  response: string;
}

export interface EntitySimpleRequest {
  entityId: string;
  request: string;
  response?: string;
  isAttachmentResponse: boolean;
}

export interface EntityPlusAttachmentRequest {
  entityId: string;
  attachmentName: string;
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
