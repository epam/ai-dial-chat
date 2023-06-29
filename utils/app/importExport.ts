import { Conversation } from '@/types/chat';
import {
  ExportConversationsFormatV4,
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  LatestExportFormat,
  PromptsHistory,
  SupportedExportFormats,
} from '@/types/export';
import { FolderInterface } from '@/types/folder';
import { Prompt } from '@/types/prompt';

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

export function isPromtsFormat(promts: any) {
  return (
    !promts[0].hasOwnProperty('messages') &&
    promts[0].hasOwnProperty('id') &&
    promts[0].hasOwnProperty('name') &&
    promts[0].hasOwnProperty('content')
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
    if (isPromtsFormat(data)) {
      return {
        ...cleanHistoryData,
        isError: true,
      };
    } else {
      return {
        ...cleanHistoryData,
        isError: false,
      };
    }
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

const triggerDownloadPrompt = (data: Prompt[]) => {
  triggerDownload(data, 'prompt');
};

export const exportConversation = (conversationId: string) => {
  let history = localStorage.getItem('conversationHistory');
  let folders = localStorage.getItem('folders');

  let conversation: Conversation | undefined;
  let convertedHistory;
  let convertedFolders;

  if (history) {
    convertedHistory = JSON.parse(history) as Conversation[];
    conversation = convertedHistory.filter(
      ({ id }) => id === conversationId,
    )[0];

    if (typeof conversation !== 'undefined') {
      convertedHistory = [conversation];
    }
  }

  if (folders) {
    convertedFolders = JSON.parse(folders) as FolderInterface[];

    if (typeof conversation !== 'undefined') {
      convertedFolders = convertedFolders.filter(
        ({ id }) => id === conversation?.folderId,
      );
    }
  }

  const data: ExportConversationsFormatV4 = {
    version: 4,
    history: convertedHistory || [],
    folders: convertedFolders || [],
  };

  triggerDownloadConversation(data);
};

export const exportConversations = () => {
  let history = localStorage.getItem('conversationHistory');
  let folders = localStorage.getItem('folders');

  if (history) {
    history = JSON.parse(history);
  }

  if (folders) {
    folders = JSON.parse(folders);
  }

  const data = {
    version: 4,
    history: history || [],
    folders: folders || [],
  } as ExportConversationsFormatV4;

  triggerDownloadConversationsHistory(data);
};

export const exportPrompts = () => {
  let prompts = localStorage.getItem('prompts');
  const promptFolders = localStorage.getItem('folders');
  let promptsToExport: Prompt[] = [];
  let promptFoldersToExport: FolderInterface[] = [];

  if (prompts) {
    promptsToExport = JSON.parse(prompts);
  }

  if (promptFolders) {
    const parsedPromptFolders: FolderInterface[] = JSON.parse(promptFolders);
    promptFoldersToExport = parsedPromptFolders.filter(
      ({ type }) => type === 'prompt',
    );
  }
  const data = {
    prompts: promptsToExport,
    folders: promptFoldersToExport,
  };
  triggerDownloadPromptsHistory(data);
};

export const exportPrompt = (promptId: string) => {
  const prompts = localStorage.getItem('prompts');

  if (prompts) {
    const parsedPrompts: Prompt[] = JSON.parse(prompts);
    const promptToExport = parsedPrompts.find(({ id }) => id === promptId);

    const data: Prompt[] = promptToExport ? [promptToExport] : [];
    triggerDownloadPrompt(data);
  }
};

export const importData = (data: SupportedExportFormats): CleanDataResponse => {
  const { history, folders, prompts, isError } = cleanData(data);

  const oldConversations = localStorage.getItem('conversationHistory');
  const oldConversationsParsed = oldConversations
    ? JSON.parse(oldConversations)
    : [];

  const newHistory: Conversation[] = [
    ...oldConversationsParsed,
    ...history,
  ].filter(
    (conversation, index, self) =>
      index === self.findIndex((c) => c.id === conversation.id),
  );
  localStorage.setItem('conversationHistory', JSON.stringify(newHistory));
  if (newHistory.length > 0) {
    localStorage.setItem(
      'selectedConversationIds',
      JSON.stringify([newHistory[newHistory.length - 1].id]),
    );
  } else {
    localStorage.removeItem('selectedConversationIds');
  }

  const oldFolders = localStorage.getItem('folders');
  const oldFoldersParsed = oldFolders ? JSON.parse(oldFolders) : [];
  const newFolders: FolderInterface[] = [
    ...oldFoldersParsed,
    ...folders,
  ].filter(
    (folder, index, self) =>
      index === self.findIndex((f) => f.id === folder.id),
  );
  localStorage.setItem('folders', JSON.stringify(newFolders));

  const oldPrompts = localStorage.getItem('prompts');
  const oldPromptsParsed = oldPrompts ? JSON.parse(oldPrompts) : [];
  const newPrompts: Prompt[] = [...oldPromptsParsed, ...prompts].filter(
    (prompt, index, self) =>
      index === self.findIndex((p) => p.id === prompt.id),
  );
  localStorage.setItem('prompts', JSON.stringify(newPrompts));

  return {
    version: 4,
    history: newHistory,
    folders: newFolders,
    prompts: newPrompts,
    isError,
  };
};

export type ImportPromtsResponse = { prompts: Prompt[]; isError: boolean };
export const importPrompts = (prompts: Prompt[]): ImportPromtsResponse => {
  const oldPrompts = localStorage.getItem('prompts');
  const oldPromptsParsed = oldPrompts ? JSON.parse(oldPrompts) : [];

  if (isPromtsFormat(prompts)) {
    const newPrompts: Prompt[] = [...oldPromptsParsed, ...prompts].filter(
      (prompt, index, self) =>
        index === self.findIndex((p) => p.id === prompt.id),
    );
    localStorage.setItem('prompts', JSON.stringify(newPrompts));

    return { prompts: newPrompts, isError: false };
  }

  return { prompts: oldPromptsParsed, isError: true };
};
