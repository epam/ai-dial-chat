import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FolderInterface, FolderType } from '@/src/types/folder';
import {
  ExportConversationsFormatV4,
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  LatestExportFormat,
  PromptsHistory,
  SupportedExportFormats,
} from '@/src/types/importExport';
import { Prompt } from '@/src/types/prompt';

import { cleanConversationHistory } from './clean';
import { combineEntities } from './common';
import { triggerDownload } from './file';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExportFormatV1(obj: any): obj is ExportFormatV1 {
  return Array.isArray(obj);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExportFormatV2(obj: any): obj is ExportFormatV2 {
  return !('version' in obj) && 'folders' in obj && 'history' in obj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExportFormatV3(obj: any): obj is ExportFormatV3 {
  return 'version' in obj && obj.version === 3;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExportFormatV4(obj: any): obj is ExportFormatV4 {
  return 'version' in obj && obj.version === 4;
}

export function isPromtsFormat(obj: PromptsHistory) {
  return Object.prototype.hasOwnProperty.call(obj, 'prompts');
}

export const isLatestExportFormat = isExportFormatV4;

export interface CleanDataResponse extends LatestExportFormat {
  isError: boolean;
}
export function cleanData(data: SupportedExportFormats): CleanDataResponse {
  if (isExportFormatV1(data)) {
    const cleanHistoryData: LatestExportFormat = {
      version: 4,
      history: cleanConversationHistory(data as unknown as Conversation[]),
      folders: [],
      prompts: [],
    };
    return {
      ...cleanHistoryData,
      isError: false,
    };
  }

  if (isExportFormatV2(data)) {
    return {
      version: 4,
      history: cleanConversationHistory(data.history || []),
      folders: (data.folders || []).map((chatFolder) => ({
        id: chatFolder.id.toString(),
        name: chatFolder.name,
        type: FolderType.Chat,
      })),
      prompts: [],
      isError: false,
    };
  }

  if (isExportFormatV3(data)) {
    return {
      history: cleanConversationHistory(data.history),
      folders: [...data.folders],
      version: 4,
      prompts: [],
      isError: false,
    };
  }

  if (isExportFormatV4(data)) {
    return {
      ...data,
      history: cleanConversationHistory(data.history),
      prompts: data.prompts || [],
      isError: false,
    };
  }

  return {
    version: 4,
    history: [],
    folders: [],
    prompts: [],
    isError: true,
  };
}

function currentDate() {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}-${day}`;
}

type ExportType =
  | 'conversation'
  | 'conversations_history'
  | 'prompt'
  | 'prompts_history';

function downloadChatPromptData(
  data: ExportConversationsFormatV4 | Prompt[] | PromptsHistory,
  exportType: ExportType,
) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  triggerDownload(url, `ai_dial_chat_${exportType}_${currentDate()}.json`);
}

const triggerDownloadConversation = (data: ExportConversationsFormatV4) => {
  downloadChatPromptData(data, 'conversation');
};
const triggerDownloadConversationsHistory = (
  data: ExportConversationsFormatV4,
) => {
  downloadChatPromptData(data, 'conversations_history');
};

const triggerDownloadPromptsHistory = (data: PromptsHistory) => {
  downloadChatPromptData(data, 'prompts_history');
};

const triggerDownloadPrompt = (data: PromptsHistory) => {
  downloadChatPromptData(data, 'prompt');
};

export const exportConversation = (
  conversation: Conversation,
  folders: FolderInterface[],
) => {
  const data: ExportConversationsFormatV4 = {
    version: 4,
    history: [conversation] || [],
    folders: folders,
  };

  triggerDownloadConversation(data);
};

interface PrepareConversationsForExport {
  conversations: Conversation[];
  folders: FolderInterface[];
}
export const prepareConversationsForExport = ({
  conversations,
  folders,
}: PrepareConversationsForExport) => {
  const data = {
    version: 4,
    history: conversations || [],
    folders: folders || [],
  } as ExportConversationsFormatV4;

  return data;
};

export const exportConversations = (
  conversations: Conversation[],
  folders: FolderInterface[],
) => {
  const data = {
    version: 4,
    history: conversations || [],
    folders: folders || [],
  } as ExportConversationsFormatV4;

  triggerDownloadConversationsHistory(data);
};

export const exportPrompts = (
  prompts: Prompt[],
  folders: FolderInterface[],
) => {
  const data = {
    prompts,
    folders,
  };
  triggerDownloadPromptsHistory(data);
};

export const exportPrompt = (prompt: Prompt, folders: FolderInterface[]) => {
  const promptsToExport: Prompt[] = [prompt];

  const data: PromptsHistory = {
    prompts: promptsToExport,
    folders,
  };
  triggerDownloadPrompt(data);
};

export interface ImportConversationsResponse {
  history: ConversationInfo[];
  folders: FolderInterface[];
  isError: boolean;
}
export const importConversations = (
  importedData: SupportedExportFormats,
  {
    currentConversations,
    currentFolders,
  }: {
    currentConversations: ConversationInfo[];
    currentFolders: FolderInterface[];
  },
): ImportConversationsResponse => {
  const { history, folders, isError } = cleanData(importedData);

  const newHistory: ConversationInfo[] = combineEntities(
    currentConversations,
    history,
  );

  const newFolders: FolderInterface[] = combineEntities(
    currentFolders,
    folders,
  ).filter((folder) => folder.type === FolderType.Chat);

  return {
    history: newHistory,
    folders: newFolders,
    isError,
  };
};

export interface ImportPromtsResponse {
  prompts: Prompt[];
  folders: FolderInterface[];
  isError: boolean;
}
export const importPrompts = (
  importedData: PromptsHistory,
  {
    currentPrompts,
    currentFolders,
  }: {
    currentPrompts: Prompt[];
    currentFolders: FolderInterface[];
  },
): ImportPromtsResponse => {
  if (!isPromtsFormat(importedData)) {
    return {
      prompts: currentPrompts,
      folders: currentFolders,
      isError: true,
    };
  }

  const newPrompts: Prompt[] = combineEntities(
    currentPrompts,
    importedData.prompts,
  );

  const newFolders: FolderInterface[] = combineEntities(
    currentFolders,
    importedData.folders,
  ).filter((folder) => folder.type === FolderType.Prompt);

  return { prompts: newPrompts, folders: newFolders, isError: false };
};
