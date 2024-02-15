import toast from 'react-hot-toast';

import {
  EMPTY,
  catchError,
  concat,
  filter,
  forkJoin,
  from,
  ignoreElements,
  map,
  mergeAll,
  of,
  switchMap,
  takeUntil,
  tap,
  zip,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { combineEntities, filterOnlyMyEntities } from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { FileService } from '@/src/utils/app/data/file-service';
import {
  getOrUploadConversation,
  getPreparedConversations,
} from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import {
  getConversationAttachmentWithPath,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import {
  ImportConversationsResponse,
  cleanData,
  exportConversation,
  exportConversations,
  exportPrompts,
  importConversations,
  updateAttachment,
} from '@/src/utils/app/import-export';
import {
  compressConversationInZip,
  downloadExportZip,
  getUnZipAttachments,
  importZippedHistory,
} from '@/src/utils/app/zip-import-export';

import { Conversation, Message, Stage } from '@/src/types/chat';
import { UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { LatestExportFormat } from '@/src/types/import-export';
import { AppEpic } from '@/src/types/store';

import { PromptsActions } from '@/src/store/prompts/prompts.reducers';

import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { getUniqueAttachments } from '../conversations/conversations.selectors';
import { FilesActions } from '../files/files.reducers';
import { selectFolders } from '../prompts/prompts.selectors';
import { SettingsSelectors } from '../settings/settings.reducers';
import {
  ImportExportActions,
  ImportExportSelectors,
} from './importExport.reducers';

const firstConversationIndex = 0;

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationAndPayload: getOrUploadConversation(
          { id: payload.conversationId },
          state$.value,
        ),
        withAttachments: of(payload.withAttachments),
        bucket: BucketService.getBucket(),
      }),
    ),
    switchMap(({ conversationAndPayload, withAttachments, bucket }) => {
      const { conversation } = conversationAndPayload;
      if (!conversation) {
        return of(ImportExportActions.exportFail());
      }
      const parentFolders = ConversationsSelectors.selectParentFolders(
        state$.value,
        conversation.folderId,
      );

      const appName = SettingsSelectors.selectAppName(state$.value);

      if (!withAttachments) {
        exportConversation(conversation, parentFolders, appName);

        return of(ImportExportActions.exportConversationSuccess());
      }

      if (!bucket.length) {
        return of(ImportExportActions.exportFail());
      }
      const attachments = ConversationsSelectors.getAttachments(
        state$.value,
        conversation.id,
      );

      return from(
        compressConversationInZip({
          attachments,
          conversation,
          parentFolders,
        }),
      ).pipe(
        switchMap((content) => {
          if (!content) {
            return of(ImportExportActions.exportFail());
          }

          downloadExportZip(content, appName);

          return of(ImportExportActions.exportConversationSuccess());
        }),
        takeUntil(action$.pipe(filter(ImportExportActions.exportCancel.match))),
      );
    }),
  );

const exportConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportConversations.match),
    switchMap(
      () => ConversationService.getConversations(undefined, true), //listing of all entities
    ),
    switchMap((conversationsListing) => {
      const foldersIds = Array.from(
        new Set(conversationsListing.map((info) => info.folderId)),
      );
      //calculate all folders;
      const foldersWithConversation = getFoldersFromIds(
        Array.from(
          new Set(
            foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
          ),
        ),
        FolderType.Chat,
      );

      const allFolders = ConversationsSelectors.selectFolders(state$.value);

      const folders = combineEntities(foldersWithConversation, allFolders);

      return forkJoin({
        //get all conversations from api
        conversations: zip(
          conversationsListing.map((info) =>
            ConversationService.getConversation(info),
          ),
        ),
        folders: of(folders),
      });
    }),
    tap(({ conversations, folders }) => {
      const filteredConversations = conversations.filter(
        Boolean,
      ) as Conversation[];

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportConversations(filteredConversations, folders, appName);
    }),
    ignoreElements(),
  );

const exportLocalStorageChatsEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(ImportExportActions.exportLocalStorageChats.match),
    switchMap(() =>
      forkJoin({
        conversations: browserStorage
          .getConversations()
          .pipe(map(filterOnlyMyEntities)),
        conversationFolders: browserStorage.getConversationsFolders(),
        appName: SettingsSelectors.selectAppName(state$.value),
      }),
    ),
    tap(({ conversations, conversationFolders, appName }) => {
      exportConversations(conversations, conversationFolders, appName, 4);
    }),
    switchMap(() =>
      of(ConversationsActions.setIsChatsBackedUp({ isChatsBackedUp: true })),
    ),
  );
};

const exportLocalStoragePromptsEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(ImportExportActions.exportLocalStoragePrompts.match),
    switchMap(() =>
      forkJoin({
        prompts: browserStorage.getPrompts().pipe(map(filterOnlyMyEntities)),
        promptFolders: browserStorage.getPromptsFolders(),
        appName: SettingsSelectors.selectAppName(state$.value),
      }),
    ),
    tap(({ prompts, promptFolders, appName }) => {
      exportPrompts(prompts, promptFolders, appName);
    }),
    switchMap(() =>
      of(PromptsActions.setIsPromptsBackedUp({ isPromptsBackedUp: true })),
    ),
  );
};

const importConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importConversations.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversationsListing: ConversationService.getConversations(
          undefined,
          true,
        ), //listing of all entities
        importedData: of(payload.data),
      }),
    ),
    switchMap(({ conversationsListing, importedData }) => {
      const foldersIds = Array.from(
        new Set(conversationsListing.map((info) => info.folderId)),
      );
      //calculate all folders;
      const folders = getFoldersFromIds(
        Array.from(
          new Set(
            foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
          ),
        ),
        FolderType.Chat,
      );

      return forkJoin({
        //get all conversations from api
        currentConversations: zip(
          conversationsListing.map((info) =>
            ConversationService.getConversation(info),
          ),
        ),
        currentFolders: of(folders),
        importedData: of(importedData),
      });
    }),
    switchMap(({ currentConversations, currentFolders, importedData }) => {
      const filteredConversations = currentConversations.filter(
        Boolean,
      ) as Conversation[];

      const { history, folders, isError }: ImportConversationsResponse =
        importConversations(importedData, {
          currentConversations: filteredConversations,
          currentFolders,
        });

      if (isError) {
        toast.error(errorsMessages.unsupportedDataFormat);
        return of(ImportExportActions.resetState());
      }

      const conversationsInfoToUpload = history.filter((conversation) => {
        return conversation.status !== UploadStatus.LOADED;
      });

      const importedConversations = conversationsInfoToUpload
        .map(({ id }) => {
          return (importedData as LatestExportFormat).history.find(
            (conversation) => conversation.id === id,
          );
        })
        .filter(Boolean) as Conversation[];

      const foldersToUpload = folders.filter(({ id }) => {
        return (importedData as LatestExportFormat).folders.find(
          (folder) => folder.id === id,
        );
      });
      // upload to the API
      const preparedConversations = getPreparedConversations({
        conversations: importedConversations,
        conversationsFolders: foldersToUpload,
      });

      const preparedHistory = [
        ...filteredConversations,
        ...preparedConversations,
      ];

      return zip(
        preparedConversations.map((info) =>
          ConversationService.createConversation(info),
        ),
      ).pipe(
        switchMap(() =>
          concat(
            of(ImportExportActions.importConversationsSuccess()),
            of(
              ConversationsActions.importConversationsSuccess({
                conversations: preparedHistory,
                folders,
              }),
            ),
          ),
        ),
        catchError(() => of(ImportExportActions.importFail())),
      );
    }),
  );

const importZipEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.importZipConversations.match),
    switchMap(({ payload }) => {
      return from(importZippedHistory(payload.zipFile)).pipe(
        switchMap((preUnzipedHistory) => {
          const { zip } = preUnzipedHistory;
          if (!preUnzipedHistory.history || !preUnzipedHistory.history.name) {
            toast.error(errorsMessages.unsupportedDataFormat);
            return of(ImportExportActions.importFail());
          }
          const file = zip.file(preUnzipedHistory.history.name);

          if (!file) {
            toast.error(errorsMessages.unsupportedDataFormat);
            return of(ImportExportActions.importFail());
          }

          return from(file.async('string')).pipe(
            switchMap((completeHistoryJson) => {
              const completeHistoryParsed = JSON.parse(completeHistoryJson);
              if (!completeHistoryParsed) {
                toast.error(errorsMessages.unsupportedDataFormat);
                return of(ImportExportActions.importFail());
              }

              const {
                history: cleanConversations,
                folders: cleanFolders,
                prompts,
                version,
                isError,
              } = cleanData(completeHistoryParsed);

              const cleanHistory: LatestExportFormat = {
                version,
                history: cleanConversations,
                folders: cleanFolders,
                prompts,
              };

              if (isError) {
                toast.error(errorsMessages.unsupportedDataFormat);
                return of(ImportExportActions.importFail());
              }
              const conversationId =
                cleanConversations[firstConversationIndex].id;
              const conversationFromState =
                ConversationsSelectors.selectConversation(
                  state$.value,
                  conversationId,
                );
              if (conversationFromState) {
                return of(ImportExportActions.resetState());
              }
              const foldersLocal = selectFolders(state$.value);
              const folders = Array.from(
                new Set([...foldersLocal, ...cleanFolders]),
              );

              const attachments = getUniqueAttachments(
                getConversationAttachmentWithPath(
                  cleanConversations[firstConversationIndex],
                  folders,
                ),
              );

              if (!attachments.length) {
                return of(
                  ImportExportActions.importConversations({
                    data: cleanHistory,
                  }),
                );
              }

              return from(
                getUnZipAttachments({ attachments, preUnzipedHistory }),
              ).pipe(
                switchMap((attachmentsToUpload) => {
                  if (!attachmentsToUpload.length) {
                    return of(ImportExportActions.importFail());
                  }
                  return of(
                    ImportExportActions.uploadConversationAttachments({
                      attachmentsToUpload,
                      completeHistory: cleanHistory,
                    }),
                  );
                }),
              );
            }),
          );
        }),
      );
    }),
  );

const uploadConversationAttachmentsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.uploadConversationAttachments.match),
    switchMap(({ payload }) => {
      const { attachmentsToUpload, completeHistory } = payload;
      const bucket = BucketService.getBucket();

      if (!bucket.length) {
        return of(ImportExportActions.importFail());
      }
      const conversation = completeHistory.history[firstConversationIndex];

      const actions = attachmentsToUpload.map((attachment) => {
        const formData = new FormData();

        if (!attachment.fileContent) {
          return of(
            ImportExportActions.uploadSingleFileFail({
              id: attachment.id,
            }),
          );
        }

        formData.append('attachment', attachment.fileContent, attachment.name);
        const isImports = attachment.relativePath?.startsWith('imports/');
        const relativePath = isImports
          ? attachment.relativePath
          : `imports/${conversation.id}/${attachment.relativePath}`;

        return FileService.sendFile(
          formData,
          relativePath,
          attachment.name,
        ).pipe(
          filter(
            ({ percent, result }) =>
              typeof percent !== 'undefined' || typeof result !== 'undefined',
          ),
          map(({ percent, result }) => {
            if (result) {
              const {
                id,
                name,
                absolutePath,
                relativePath,
                status,
                percent,
                contentType,
              } = result;
              return ImportExportActions.uploadSingleAttachmentSuccess({
                apiResult: {
                  id,
                  name,
                  absolutePath,
                  relativePath,
                  status,
                  percent,
                  contentType,
                },
              });
            }

            return FilesActions.uploadFileTick({
              id: attachment.id,
              percent: percent!,
            });
          }),
          catchError(() => {
            return of(
              ImportExportActions.uploadSingleFileFail({
                id: attachment.id,
              }),
            );
          }),
        );
      });
      mergeAll(5);
      return concat(...actions).pipe(
        takeUntil(action$.pipe(filter(ImportExportActions.importStop.match))),
      );
    }),
  );

const uploadAllAttachmentsSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadSingleAttachmentSuccess.match),
    map(() => ({
      attachmentsToUpload: ImportExportSelectors.selectAttachmentsIdsToUpload(
        state$.value,
      ),
      uploadedAttachments: ImportExportSelectors.selectUploadedAttachments(
        state$.value,
      ),
      loadedHistory: ImportExportSelectors.selectImportedHistory(state$.value),
      attachmentsErrors: ImportExportSelectors.selectAttachmentsErrors(
        state$.value,
      ),
    })),
    switchMap((payload) => {
      const {
        attachmentsToUpload,
        uploadedAttachments,
        loadedHistory,
        attachmentsErrors,
      } = payload;

      if (!uploadedAttachments.length) {
        return of(ImportExportActions.importFail());
      }

      const allUploadedAmount =
        uploadedAttachments.length + attachmentsErrors.length;

      if (
        attachmentsToUpload.length &&
        attachmentsToUpload.length !== uploadedAttachments.length &&
        attachmentsToUpload.length === allUploadedAmount
      ) {
        return of(ImportExportActions.importFail());
      }

      if (
        attachmentsToUpload.length &&
        attachmentsToUpload.length === uploadedAttachments.length
      ) {
        const updatedMessages: Message[] = loadedHistory.history[
          firstConversationIndex
        ].messages.map((message) => {
          if (!message.custom_content?.attachments) {
            return message;
          }

          const newAttachments = message.custom_content.attachments.map(
            (oldAttachment) =>
              updateAttachment({ oldAttachment, uploadedAttachments }),
          );

          const newStages: Stage[] | undefined =
            message.custom_content.stages &&
            message.custom_content.stages.map((stage) => {
              if (!stage.attachments) {
                return stage;
              }
              const newStageAttachments = stage.attachments.map(
                (oldAttachment) =>
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
        });

        const updatedConversation: Conversation = {
          ...loadedHistory.history[firstConversationIndex],
          messages: updatedMessages,
        };
        return of(
          ImportExportActions.importConversations({
            data: { ...loadedHistory, history: [updatedConversation] },
          }),
        );
      }
      return EMPTY;
    }),
  );

const checkImportFailEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadSingleFileFail.match),
    map(() => ({
      attachmentsErrors: ImportExportSelectors.selectAttachmentsErrors(
        state$.value,
      ),
      attachmentsToUpload: ImportExportSelectors.selectAttachmentsIdsToUpload(
        state$.value,
      ),
    })),
    switchMap(({ attachmentsErrors, attachmentsToUpload }) => {
      if (
        attachmentsErrors.length &&
        attachmentsToUpload.length === attachmentsErrors.length
      ) {
        return of(ImportExportActions.importFail());
      }
      return EMPTY;
    }),
  );

const importFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importFail.match),
    tap(() => {
      toast.error(errorsMessages.importFailed);
    }),
    ignoreElements(),
  );

const exportFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.exportFail.match),
    tap(() => {
      toast.error(errorsMessages.exportFailed);
    }),
    ignoreElements(),
  );

const resetStateEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ImportExportActions.exportCancel.match(action) ||
        ImportExportActions.exportConversationSuccess.match(action) ||
        ImportExportActions.exportFail.match(action) ||
        ImportExportActions.importStop.match(action) ||
        ImportExportActions.importConversationsSuccess.match(action) ||
        ImportExportActions.importFail.match(action),
    ),
    switchMap(() => {
      return of(ImportExportActions.resetState());
    }),
  );

export const ImportExportEpics = combineEpics(
  exportConversationEpic,
  exportConversationsEpic,
  importConversationsEpic,
  importZipEpic,
  uploadConversationAttachmentsEpic,
  uploadAllAttachmentsSuccessEpic,
  resetStateEpic,
  importFailEpic,
  exportFailEpic,
  checkImportFailEpic,
  exportLocalStorageChatsEpic,
  exportLocalStoragePromptsEpic,
);
