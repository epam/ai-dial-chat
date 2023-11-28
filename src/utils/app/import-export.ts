import { Conversation } from '@/src/types/chat';
import {
  ExportConversationsFormatV4,
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  LatestExportFormat,
  PromptsHistory,
  SupportedExportFormats,
} from '@/src/types/export';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { cleanConversationHistory } from './clean';
import { triggerDownload } from './file';

export function isExportFormatV1(obj: any): obj is ExportFormatV1 {
  return Array.isArray(obj);
}

export function isExportFormatV2(obj: any): obj is ExportFormatV2 {
  return !('version' in obj) && 'folders' in obj && 'history' in obj;
}

export function isExportFormatV3(obj: any): obj is ExportFormatV3 {
  return obj.version === 3;
}

export function isExportFormatV4(obj: any): obj is ExportFormatV4 {
  return obj.version === 4;
}

export function isPromtsFormat(obj: any) {
  return (
    obj &&
    typeof obj === 'object' &&
    Object.prototype.hasOwnProperty.call(obj, 'prompts')
  );
}

export const isLatestExportFormat = isExportFormatV4;

export interface CleanDataResponse extends LatestExportFormat {
  isError: boolean;
}
export function cleanData(data: SupportedExportFormats): CleanDataResponse {
  if (isExportFormatV1(data)) {
    const cleanHistoryData: LatestExportFormat = {
      version: 4,
      history: cleanConversationHistory(data),
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
        type: 'chat',
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

  triggerDownload(url, `chatbot_ui_${exportType}_${currentDate()}.json`);
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
  history: Conversation[];
  folders: FolderInterface[];
  isError: boolean;
}
export const importConversations = (
  importedData: SupportedExportFormats,
  {
    currentConversations,
    currentFolders,
  }: {
    currentConversations: Conversation[];
    currentFolders: FolderInterface[];
  },
): ImportConversationsResponse => {
  const { history, folders, isError } = cleanData(importedData);

  const newHistory: Conversation[] = [
    ...currentConversations,
    ...history,
  ].filter(
    (conversation, index, self) =>
      index === self.findIndex((c) => c.id === conversation.id),
  );

  const newFolders: FolderInterface[] = [...currentFolders, ...folders]
    .filter(
      (folder, index, self) =>
        index === self.findIndex((f) => f.id === folder.id),
    )
    .filter((folder) => folder.type === 'chat');

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

  const newPrompts: Prompt[] = currentPrompts
    .concat(importedData.prompts)
    .filter(
      (prompt, index, self) =>
        index === self.findIndex((p) => p.id === prompt.id),
    );

  const newFolders: FolderInterface[] = currentFolders
    .concat(importedData.folders)
    .filter(
      (folder, index, self) =>
        index === self.findIndex((p) => p.id === folder.id),
    )
    .filter((folder) => folder.type === 'prompt');

  return { prompts: newPrompts, folders: newFolders, isError: false };
};
