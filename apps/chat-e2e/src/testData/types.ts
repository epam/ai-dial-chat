export interface TreeEntity {
  name: string;
  index?: number;
}

export type ElementState = 'visible' | 'hidden';

export type ElementActionabilityState = 'enabled' | 'disabled';

export type ElementCaretState = 'expanded' | 'collapsed';

export type ElementLabel = 'more' | 'less';

export type Sorting = 'asc' | 'desc';

export enum EntityType {
  Conversation,
  Prompt,
}

export enum CollapsedSections {
  Organization = 'Organization',
  SharedWithMe = 'Shared with me',
}

export enum PublishPath {
  Organization = 'Organization',
}

export interface Entity {
  entityId: string;
}

export interface ArithmeticRequestEntity extends Entity {
  isSysPromptAllowed?: boolean;
  systemPrompt?: string;
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

export enum MarketplaceFilterTypes {
  type = 'Type',
  topics = 'Topics',
  sources = 'Sources',
}

export enum SourcesFilterOptions {
  public = 'Public',
  sharedWithMe = 'Shared with me',
  myCustomApps = 'My Custom apps',
  myExternalApps = 'My External apps',
  myQuickApps = 'My Quick apps',
  myCodeApps = 'My Code apps',
}

export enum ApplicationTypes {
  CUSTOM_APP = 'custom app',
  CODE_APP = 'code app',
}

export enum ImportResolutionOption {
  Replace = 'Replace',
  Postfix = 'Postfix',
  Ignore = 'Ignore',
}

export enum OAuthOptions {
  WithLogin = 'With login',
  WithConfig = 'With login & config',
}
