import { EMPTY, Observable, map, of } from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface, FolderType } from '@/src/types/folder';
import {
  ExportFormatV1,
  ExportFormatV2,
  ExportFormatV3,
  ExportFormatV4,
  ExportFormatV5,
  LatestExportConversationsFormat,
  LatestExportFormat,
  MappedReplaceActions,
  PromptsHistory,
  ReplaceOptions,
  SupportedExportFormats,
} from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { UploadedAttachment } from '@/src/store/import-export/importExport.reducers';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { PLOTLY_CONTENT_TYPE } from '@/src/constants/chat';
import { successMessages } from '@/src/constants/successMessages';

import { ApiUtils } from '../server/api';
import { cleanConversationHistory } from './clean';
import { isImportEntityNameOnSameLevelUnique } from './common';
import { ConversationService } from './data/conversation-service';
import { constructPath, triggerDownload } from './file';
import { splitEntityId } from './folders';
import { getConversationRootId, getFileRootId } from './id';
import { translate } from './translation';

import { Attachment, Message, Stage } from '@epam/ai-dial-shared';

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

  const newAttachmentUrl =
    (oldAttachment.url || oldAttachment.reference_url) &&
    (newAttachmentFile
      ? constructPath(newAttachmentFile.absolutePath, newAttachmentFile.name)
      : constructPath(getFileRootId(), parentPath, name));

  const encodedNewAttachmentUrl =
    newAttachmentUrl && ApiUtils.encodeApiUrl(newAttachmentUrl);
  const newReferenceUrl =
    oldAttachment.reference_url &&
    encodedNewAttachmentUrl &&
    `${encodedNewAttachmentUrl}#${oldHash}`;

  const newType = oldAttachment.type ?? newAttachmentFile?.contentType;

  const newTitle =
    oldAttachment.type === PLOTLY_CONTENT_TYPE
      ? oldAttachment.title ?? newAttachmentFile?.name
      : newAttachmentFile?.name ?? oldAttachment.title;

  const updatedAttachment: Attachment = {
    ...oldAttachment,
    title: newTitle,
    type: newType,
    url: encodedNewAttachmentUrl,
    reference_url: newReferenceUrl,
  };
  return updatedAttachment;
};

export const getDuplicatedConversations = (
  preparedConversations: Conversation[],
): Observable<{
  newConversations: Conversation[];
  duplicatedConversations: Conversation[];
}> => {
  return ConversationService.getConversations(undefined, true).pipe(
    map((conversationsListing) => {
      const existedImportNamesConversations = preparedConversations.filter(
        (importConv) =>
          !isImportEntityNameOnSameLevelUnique({
            entity: importConv,
            entities: conversationsListing,
          }),
      );

      const nonExistedImportNamesConversations = preparedConversations.filter(
        (importConv) => {
          return isImportEntityNameOnSameLevelUnique({
            entity: importConv,
            entities: conversationsListing,
          });
        },
      );

      return {
        newConversations: nonExistedImportNamesConversations,
        duplicatedConversations: existedImportNamesConversations,
      };
    }),
  );
};

export const getConversationActions = (
  conversation: Conversation,
  index: number,
): Observable<AnyAction>[] => {
  const firstConversationActions: Observable<AnyAction>[] = [];
  if (index === 0) {
    firstConversationActions.push(
      of(
        ConversationsActions.selectConversations({
          conversationIds: [conversation.id],
        }),
      ),
      of(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: [conversation.folderId],
          featureType: FeatureType.Chat,
        }),
      ),
    );
  }

  return [
    of(ConversationsActions.saveConversation(conversation)),
    of(
      ConversationsActions.updateConversationSuccess({
        id: conversation.id,
        conversation,
      }),
    ),
    ...firstConversationActions,
  ];
};

export const getPromptActions = (
  prompt: Prompt,
  index: number,
): Observable<AnyAction>[] => {
  const firstPromptAction: Observable<AnyAction> =
    index === 0
      ? of(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: [prompt.folderId],
            featureType: FeatureType.Prompt,
          }),
        )
      : EMPTY;

  return [
    of(PromptsActions.savePrompt(prompt)),
    of(
      PromptsActions.updatePromptSuccess({
        id: prompt.id,
        prompt,
      }),
    ),
    firstPromptAction,
  ];
};

export const getToastAction = (
  errorList: string[],
  featureType: string,
): Observable<AnyAction> => {
  const errorMessage = `It looks like these ${featureType}(s) ${errorList.join(', ')} have been deleted. Please reload the page and try again`;
  const successMessage = `${featureType}(s) ${successMessages.importSuccess}`;

  if (errorList.length > 0) {
    return of(UIActions.showErrorToast(translate(errorMessage)));
  } else {
    return of(UIActions.showSuccessToast(translate(successMessage)));
  }
};

export const getMappedActions = (
  items: Conversation[] | Prompt[] | DialFile[],
  action?: ReplaceOptions,
) => {
  const replaceActions: MappedReplaceActions = {};
  items.forEach((item) => {
    replaceActions[item.id] = action ?? ReplaceOptions.Postfix;
  });
  return { ...replaceActions };
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
