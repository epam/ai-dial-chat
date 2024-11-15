import { BackendResourceType } from './common';

export enum SharingType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
  File = 'file',
  Application = 'application',
}

export interface UserGroup {
  id: string;
  name: string;
}

export interface InvitationDetails {
  id: string;
  resources: { url: string }[];
  createdAt: number;
  expireAt: number;
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
