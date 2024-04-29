import { BackendResourceType } from './common';
import { PublicationFunctions } from './publication';

export interface ShareInterface {
  isShared?: boolean;
  sharedWithMe?: boolean;

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
  File = 'file',
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

export interface InvitationDetails {
  id: string;
  resources: { url: string }[];
  createdAt: number;
  expireAt: number;
}

export interface TargetAudienceFilter extends TargetAudienceFilterItem {
  filterType: PublicationFunctions;
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

export interface ShareRevokeRequestModel {
  resources: {
    url: string;
  }[];
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
