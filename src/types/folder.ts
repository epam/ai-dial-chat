import { ShareEntity } from './common';
import { EntityFilters } from './search';

export interface FolderInterface extends ShareEntity {
  type: FolderType;
  temporary?: boolean;
  serverSynced?: boolean;
}

export enum FolderType {
  Chat = 'chat',
  Prompt = 'prompt',
  File = 'file',
}

export interface FolderSectionProps {
  hidden?: boolean;
  name: string;
  dataQa: string;
  hideIfEmpty?: boolean;
  displayRootFiles?: boolean;
  filters: EntityFilters;
  showEmptyFolders?: boolean;
  openByDefault?: boolean;
}

export enum MoveType {
  Conversation = 'conversation',
  ConversationFolder = 'conversations_folder',
  Prompt = 'prompt',
  PromptFolder = 'prompts_folder',
  File = 'file',
  FileFolder = 'files_folder',
}
