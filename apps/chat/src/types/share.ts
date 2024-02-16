import { BackendResourceType } from './common';

export interface ShareInterface {
  isShared?: boolean;
  sharedWithMe?: boolean;
  sharedWithMeChild?: boolean;

  isPublished?: boolean;
  publishedWithMe?: boolean;
  originalId?: string; // TODO: revise that when publishing will be in work
  publishVersion?: string;
}

export enum SharingType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
}

export interface UserGroup {
  id: string;
  name: string;
}

export interface TargetAudienceFilterItem {
  id: string;
  name: string;
}

export enum FiltersTypes {
  Contains = 'Contains',
  NotContains = 'Not contains',
  Equals = 'Equals',
  Regex = 'Regex',
}

export interface TargetAudienceFilter extends TargetAudienceFilterItem {
  filterType: FiltersTypes;
  filterParams: string[];
}

export interface PublishRequest {
  id: string;
  name: string;
  path: string;
  version: string;
  fileNameMapping: Map<string, string>;
  targetAudienceFilters?: {
    userGroups?: UserGroup[];
    other: TargetAudienceFilter[];
  };
}

export enum ShareRequestType {
  email = 'email',
  link = 'link',
}

export interface ShareRequestModel {
  invitationType: ShareRequestType;
  resources: { url: string }[];
}

// Email sharing not implemented on BE
export interface ShareByEmailRequestModel extends ShareRequestModel {
  invitationType: ShareRequestType.email;
  emails: string[];
}

export interface ShareByLinkRequestModel extends ShareRequestModel {
  invitationType: ShareRequestType.link;
}

export interface ShareByLinkResponseModel {
  invitationLink: string;
}

export interface ShareAcceptRequestModel {
  invitationId: string;
}

export enum ShareRelations {
  me = 'me',
  others = 'others',
}

export interface ShareListingRequestModel {
  resourceTypes: BackendResourceType[];
  with: ShareRelations;
  order: 'popular_asc';
}
