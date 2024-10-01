import { Conversation } from './chat';
import { FolderInterface } from './folder';
import { Prompt } from './prompt';

import { Message } from '@epam/ai-dial-shared';

export type SupportedExportFormats =
  | ExportFormatV1
  | ExportFormatV2
  | ExportFormatV3
  | ExportFormatV4
  | ExportConversationsFormatV4
  | ExportConversationsFormatV5;
export type LatestExportFormat = ExportFormatV5;
export type LatestExportConversationsFormat = ExportConversationsFormatV5;

////////////////////////////////////////////////////////////////////////////////////////////
interface ConversationV1 {
  id: number;
  name: string;
  messages: Message[];
}

export type ExportFormatV1 = ConversationV1[];

////////////////////////////////////////////////////////////////////////////////////////////
interface ChatFolder {
  id: number;
  name: string;
}

export interface ExportFormatV2 {
  history: Conversation[] | null;
  folders: ChatFolder[] | null;
}

////////////////////////////////////////////////////////////////////////////////////////////
export interface ExportFormatV3 {
  version: 3;
  history: Conversation[];
  folders: FolderInterface[];
}

export interface ExportFormatV4 {
  version: 4;
  history: Conversation[];
  folders: FolderInterface[];
  prompts: Prompt[];
}

export interface ExportFormatV5 {
  version: 5;
  history: Conversation[];
  folders: FolderInterface[];
  prompts: Prompt[];
}
/////////////////////////////////////////////////////////////////////////////////////////////
export interface ExportConversationsFormatV4 {
  version: 4;
  history: Conversation[];
  folders: FolderInterface[];
}

/////////////////////////////////////////////////////////////////////////////////////////////
export type ExportConversationsFormatV5 = Omit<
  ExportConversationsFormatV4,
  'version'
> & {
  version: 5;
};

/////////////////////////////////////////////////////////////////////////////////////////////

export interface PromptsHistory {
  prompts: Prompt[];
  folders: FolderInterface[];
}

export enum Operation {
  Importing = 'Importing',
  Exporting = 'Exporting',
}

export enum ImportRoot {
  Imports = 'imports',
  Files = 'files',
}

export enum ReplaceOptions {
  Postfix = 'Postfix',
  Replace = 'Replace',
  Ignore = 'Ignore',
  Mixed = 'Mixed',
}

export type MappedReplaceActions = Record<string, ReplaceOptions>;
