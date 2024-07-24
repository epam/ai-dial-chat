import { Attachment, Conversation, Message, Stage } from '@/src/types/chat';
import { FolderInterface, FolderType } from '@/src/types/folder';
import {
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  ExportFormatV5,
  LatestExportConversationsFormat,
  LatestExportFormat,
  PromptsHistory,
  SupportedExportFormats,
} from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import { UploadedAttachment } from '@/src/store/import-export/importExport.reducers';

import { PLOTLY_CONTENT_TYPE } from '@/src/constants/chat';

import { ApiUtils } from '../server/api';
import { cleanConversationHistory } from './clean';
import { constructPath, triggerDownload } from './file';
import { splitEntityId } from './folders';
import { getConversationRootId } from './id';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExportFormatV5(obj: any): obj is ExportFormatV5 {
  return 'version' in obj && obj.version === 5;
}

export function isPromptsFormat(obj: PromptsHistory) {
  return Object.prototype.hasOwnProperty.call(obj, 'prompts');
}

export const isLatestExportFormat = isExportFormatV5;

export interface CleanDataResponse extends LatestExportFormat {
  isError: boolean;
}

export function cleanData(data: SupportedExportFormats): CleanDataResponse {
  if (isExportFormatV1(data)) {
    const cleanHistoryData: LatestExportFormat = {
      version: 5,
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
      version: 5,
      history: cleanConversationHistory(data.history || []),
      folders: (data.folders || []).map((chatFolder) => ({
        id: chatFolder.id.toString(),
        name: chatFolder.name,
        type: FolderType.Chat,
        folderId: getConversationRootId(),
      })),
      prompts: [],
      isError: false,
    };
  }

  if (isExportFormatV3(data)) {
    return {
      history: cleanConversationHistory(data.history),
      folders: [...data.folders],
      version: 5,
      prompts: [],
      isError: false,
    };
  }

  if (isExportFormatV4(data)) {
    return {
      ...data,
      version: 5,
      history: cleanConversationHistory(data.history),
      prompts: data.prompts || [],
      isError: false,
    };
  }

  if (isExportFormatV5(data)) {
    return {
      ...data,
      history: cleanConversationHistory(data.history),
      prompts: data.prompts || [],
      isError: false,
    };
  }

  return {
    version: 5,
    history: [],
    folders: [],
    prompts: [],
    isError: true,
  };
}

export function currentDate() {
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

export const getDownloadFileName = (fileName?: string): string =>
  !fileName ? 'ai_dial' : fileName.toLowerCase().replaceAll(' ', '_');

function downloadChatPromptData(
  data: LatestExportConversationsFormat | Prompt[] | PromptsHistory,
  exportType: ExportType,
  fileName?: string,
) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const downloadName = getDownloadFileName(fileName);

  triggerDownload(
    url,
    `${downloadName}_chat_${exportType}_${currentDate()}.json`,
  );
}

const triggerDownloadConversation = (
  data: LatestExportConversationsFormat,
  appName?: string,
) => {
  downloadChatPromptData(data, 'conversation', appName);
};
const triggerDownloadConversationsHistory = (
  data: LatestExportConversationsFormat,
  appName?: string,
) => {
  downloadChatPromptData(data, 'conversations_history', appName);
};

const triggerDownloadPromptsHistory = (
  data: PromptsHistory,
  appName?: string,
) => {
  downloadChatPromptData(data, 'prompts_history', appName);
};

const triggerDownloadPrompt = (data: PromptsHistory, appName?: string) => {
  downloadChatPromptData(data, 'prompt', appName);
};

export const exportConversation = (
  conversation: Conversation,
  folders: FolderInterface[],
  appName?: string,
) => {
  const data: LatestExportConversationsFormat = {
    version: 5,
    history: [conversation] || [],
    folders: folders,
  };

  triggerDownloadConversation(data, appName);
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
    version: 5,
    history: conversations || [],
    folders: folders || [],
  } as LatestExportConversationsFormat;

  return data;
};

export const exportConversations = (
  conversations: Conversation[],
  folders: FolderInterface[],
  appName?: string,
  version = 5,
) => {
  const data = {
    version,
    history: conversations || [],
    folders: folders || [],
  } as LatestExportConversationsFormat;

  triggerDownloadConversationsHistory(data, appName);
};

export const exportPrompts = (
  prompts: Prompt[],
  folders: FolderInterface[],
  appName?: string,
) => {
  const data = {
    prompts,
    folders,
  };
  triggerDownloadPromptsHistory(data, appName);
};

export const exportPrompt = (
  prompt: Prompt,
  folders: FolderInterface[],
  appName?: string,
) => {
  const promptsToExport: Prompt[] = [prompt];

  const data: PromptsHistory = {
    prompts: promptsToExport,
    folders,
  };
  triggerDownloadPrompt(data, appName);
};

export const updateAttachment = ({
  oldAttachment,
  uploadedAttachments,
}: {
  oldAttachment: Attachment;
  uploadedAttachments: UploadedAttachment[];
}) => {
  const oldAttachmentUrl = oldAttachment.url || oldAttachment.reference_url;
  if (!oldAttachmentUrl) {
    return oldAttachment;
  }

  const oldAttachmentDecodedUrl = ApiUtils.decodeApiUrl(oldAttachmentUrl);

  const { name, parentPath } = splitEntityId(oldAttachmentDecodedUrl);

  const oldAttachmentRelativePath = constructPath(parentPath, name);

  const splitByHash = (stringToSplit: string) => {
    const nameArr = stringToSplit.split('#');
    const oldName = nameArr[0];
    const oldHash = nameArr[nameArr.length - 1];

    return {
      oldName,
      oldHash,
    };
  };

  const { oldHash } = splitByHash(name);
  const { oldName: cleanOldAttachmentRelativePath } = splitByHash(
    oldAttachmentRelativePath,
  );

  const newAttachmentFile = uploadedAttachments.find(({ oldRelativePath }) => {
    return oldRelativePath === cleanOldAttachmentRelativePath;
  });

  if (!newAttachmentFile || !newAttachmentFile.name) {
    return oldAttachment;
  }

  const newReferenceUrl =
    oldAttachment.reference_url &&
    ApiUtils.encodeApiUrl(
      constructPath(newAttachmentFile.absolutePath, newAttachmentFile.name),
    ) + `#${oldHash}`;

  // TODO: remove ApiUtils.encodeApiUrl from updateAttachment()
  const newAttachmentUrl =
    oldAttachment.url &&
    ApiUtils.encodeApiUrl(
      constructPath(newAttachmentFile.absolutePath, newAttachmentFile.name),
    );

  const newType = oldAttachment.type ?? newAttachmentFile.contentType;

  const newTitle =
    oldAttachment.type === PLOTLY_CONTENT_TYPE
      ? oldAttachment.title ?? newAttachmentFile.name
      : newAttachmentFile.name ?? oldAttachment.title;

  const updatedAttachment: Attachment = {
    ...oldAttachment,
    title: newTitle,
    type: newType,
    url: newAttachmentUrl,
    reference_url: newReferenceUrl,
  };
  return updatedAttachment;
};

export const updateMessageAttachments = ({
  message,
  uploadedAttachments,
}: {
  message: Message;
  uploadedAttachments: UploadedAttachment[];
}) => {
  if (!message.custom_content?.attachments) {
    return message;
  }

  const newAttachments = message.custom_content.attachments.map(
    (oldAttachment) => updateAttachment({ oldAttachment, uploadedAttachments }),
  );

  const newStages: Stage[] | undefined =
    message.custom_content.stages &&
    message.custom_content.stages.map((stage) => {
      if (!stage.attachments) {
        return stage;
      }
      const newStageAttachments = stage.attachments.map((oldAttachment) =>
        updateAttachment({ oldAttachment, uploadedAttachments }),
      );
      return {
        ...stage,
        attachments: newStageAttachments,
      };
    });

  const newCustomContent: Message['custom_content'] = {
    ...message.custom_content,
    attachments: newAttachments,
    stages: newStages,
  };
  return {
    ...message,
    custom_content: newCustomContent,
  };
};
