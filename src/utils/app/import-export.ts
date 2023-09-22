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

function triggerDownload(
  data: ExportConversationsFormatV4 | Prompt[] | PromptsHistory,
  exportType: ExportType,
) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `chatbot_ui_${exportType}_${currentDate()}.json`;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const triggerDownloadConversation = (data: ExportConversationsFormatV4) => {
  triggerDownload(data, 'conversation');
};
const triggerDownloadConversationsHistory = (
  data: ExportConversationsFormatV4,
) => {
  triggerDownload(data, 'conversations_history');
};

const triggerDownloadPromptsHistory = (data: PromptsHistory) => {
  triggerDownload(data, 'prompts_history');
};

const triggerDownloadPrompt = (data: PromptsHistory) => {
  triggerDownload(data, 'prompt');
};

export const exportConversation = (
  conversation: Conversation,
  folder: FolderInterface | undefined,
) => {
  const data: ExportConversationsFormatV4 = {
    version: 4,
    history: [conversation] || [],
    folders: folder ? [folder] : [],
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

export const exportPrompt = (promptId: string) => {
  const prompts = localStorage.getItem('prompts');
  const folders = localStorage.getItem('folders');

  if (prompts) {
    const parsedPrompts: Prompt[] = JSON.parse(prompts);
    const promptToExport = parsedPrompts.find(({ id }) => id === promptId);
    let promptFoldersToExport: any[] = [];

    if (promptToExport) {
      const promptsToExport: Prompt[] = [promptToExport];

      if (promptToExport.folderId && folders) {
        const parsedPromptFolders: FolderInterface[] = JSON.parse(folders);
        promptFoldersToExport = parsedPromptFolders.filter(
          ({ id }) => id === promptToExport.folderId,
        );
      }

      const data: PromptsHistory = {
        prompts: promptsToExport,
        folders: promptFoldersToExport,
      };
      triggerDownloadPrompt(data);
    }
  }
};

export const importData = (data: SupportedExportFormats): CleanDataResponse => {
  const { history, folders, prompts, isError } = cleanData(data);
  const oldConversations = localStorage.getItem('conversationHistory');
  let cleanedConversationHistory: Conversation[] = [];
  if (oldConversations) {
    const parsedConversationHistory: Conversation[] =
      JSON.parse(oldConversations);
    cleanedConversationHistory = cleanConversationHistory(
      parsedConversationHistory,
    );
  }

  const newHistory: Conversation[] = [
    ...cleanedConversationHistory,
    ...history,
  ].filter(
    (conversation, index, self) =>
      index === self.findIndex((c) => c.id === conversation.id),
  );

  const oldFolders = localStorage.getItem('folders');
  const oldFoldersParsed = oldFolders ? JSON.parse(oldFolders) : [];
  const newFolders: FolderInterface[] = [...oldFoldersParsed, ...folders]
    .filter(
      (folder, index, self) =>
        index === self.findIndex((f) => f.id === folder.id),
    )
    .filter((folder) => folder.type === 'chat');

  const oldPrompts = localStorage.getItem('prompts');
  const oldPromptsParsed = oldPrompts ? JSON.parse(oldPrompts) : [];
  const newPrompts: Prompt[] = [...oldPromptsParsed, ...prompts].filter(
    (prompt, index, self) =>
      index === self.findIndex((p) => p.id === prompt.id),
  );

  return {
    version: 4,
    history: newHistory,
    folders: newFolders,
    prompts: newPrompts,
    isError,
  };
};

export interface ImportPromtsResponse {
  prompts: Prompt[];
  folders: FolderInterface[];
  isError: boolean;
}
export const importPrompts = (
  promptsHistory: PromptsHistory,
): ImportPromtsResponse => {
  const oldPrompts = localStorage.getItem('prompts');
  const oldPromptsParsed: Prompt[] = oldPrompts ? JSON.parse(oldPrompts) : [];

  const oldPromptsFolders = localStorage.getItem('folders');
  const oldFoldersParsed: FolderInterface[] = oldPromptsFolders
    ? JSON.parse(oldPromptsFolders)
    : [];

  if (isPromtsFormat(promptsHistory)) {
    const newPrompts: Prompt[] = oldPromptsParsed
      .concat(promptsHistory.prompts)
      .filter(
        (prompt, index, self) =>
          index === self.findIndex((p) => p.id === prompt.id),
      );

    const newFolders: FolderInterface[] = oldFoldersParsed
      .concat(promptsHistory.folders)
      .filter(
        (folder, index, self) =>
          index === self.findIndex((p) => p.id === folder.id),
      )
      .filter((folder) => folder.type === 'prompt');

    return { prompts: newPrompts, folders: newFolders, isError: false };
  }

  return {
    prompts: oldPromptsParsed,
    folders: oldFoldersParsed,
    isError: true,
  };
};
