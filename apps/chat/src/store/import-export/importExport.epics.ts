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
  toArray,
  zip,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { combineEntities, filterOnlyMyEntities } from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { FileService } from '@/src/utils/app/data/file-service';
import {
  getImportPreparedConversations,
  getOrUploadConversation,
} from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { constructPath } from '@/src/utils/app/file';
import {
  generateNextName,
  getConversationAttachmentWithPath,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
  splitEntityId,
} from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';
import {
  cleanConversationsFolders,
  cleanData,
  exportConversation,
  exportConversations,
  exportPrompts,
  updateAttachment,
} from '@/src/utils/app/import-export';
import { translate } from '@/src/utils/app/translation';
import {
  compressConversationInZip,
  downloadExportZip,
  getUnZipAttachments,
  importZippedHistory,
} from '@/src/utils/app/zip-import-export';

import { Conversation, Message, Stage } from '@/src/types/chat';
import { FolderType } from '@/src/types/folder';
import { ImportRoot, LatestExportFormat } from '@/src/types/import-export';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { getUniqueAttachments } from '../conversations/conversations.selectors';
import { FilesActions } from '../files/files.reducers';
import { PromptsActions } from '../prompts/prompts.reducers';
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
      const onlyMyConversationsListing =
        filterOnlyMyEntities(conversationsListing);
      const foldersIds = Array.from(
        new Set(onlyMyConversationsListing.map((info) => info.folderId)),
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
          onlyMyConversationsListing.map((info) =>
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

const exportLocalStorageEntitiesEpic: AppEpic = (action$, state$) => {
  const browserStorage = new BrowserStorage();

  return action$.pipe(
    filter(ImportExportActions.exportLocalStorageEntities.match),
    switchMap(() =>
      forkJoin({
        conversations: browserStorage
          .getConversations()
          .pipe(map(filterOnlyMyEntities)),
        conversationFolders: browserStorage.getConversationsFolders(),
        prompts: browserStorage.getPrompts().pipe(map(filterOnlyMyEntities)),
        promptFolders: browserStorage.getPromptsFolders(),
        appName: SettingsSelectors.selectAppName(state$.value),
      }),
    ),
    tap(
      ({
        conversations,
        conversationFolders,
        prompts,
        promptFolders,
        appName,
      }) => {
        exportConversations(conversations, conversationFolders, appName, 4);
        exportPrompts(prompts, promptFolders);
      },
    ),
    ignoreElements(),
  );
};

const importConversationsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importConversations.match),
    switchMap(({ payload }) => {
      const { history, folders, isError } = cleanData(payload.data);
      if (isError) {
        toast.error(errorsMessages.unsupportedDataFormat);
        return of(ImportExportActions.importFail());
      }

      const preparedConversations = getImportPreparedConversations({
        conversations: history,
        conversationsFolders: folders,
      }) as Conversation[];

      return from(
        ConversationService.setConversations(preparedConversations),
      ).pipe(
        toArray(),
        switchMap(() => {
          return ConversationService.getConversations(undefined, true).pipe(
            catchError(() => {
              toast.error(
                translate(
                  'An error occurred while uploading conversations and folders',
                ),
              );
              return [];
            }),
          ); //listing of all entities
        }),
        switchMap((conversationsListing) => {
          if (preparedConversations.length && !conversationsListing.length) {
            return of(ImportExportActions.importPromptsFail());
          }

          const foldersIds = Array.from(
            new Set(conversationsListing.map((info) => info.folderId)),
          );
          //calculate all folders;
          const conversationsFolders = getFoldersFromIds(
            Array.from(
              new Set(
                foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id)),
              ),
            ),
            FolderType.Chat,
          );

          const cleanFolders = cleanConversationsFolders(folders);

          const newFolders = combineEntities(
            conversationsFolders,
            cleanFolders,
          );

          return concat(
            of(
              ConversationsActions.importConversationsSuccess({
                conversations: conversationsListing,
                folders: newFolders,
              }),
            ),
            of(ImportExportActions.importConversationsSuccess()),
          );
        }),
      );
    }),
    catchError(() => of(ImportExportActions.importPromptsFail())),
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

      const importFolderPath = constructPath(getRootId(), ImportRoot.Imports);

      return forkJoin({
        folders: FileService.getFileFolders(importFolderPath),
        attachmentsToUpload: of(attachmentsToUpload),
      }).pipe(
        switchMap(({ folders, attachmentsToUpload }) => {
          const conversation = completeHistory.history[firstConversationIndex];
          const conversationName = conversation.name;
          const isFolderNameExist = folders.some(
            (folder) => folder.name === conversationName,
          );
          const rootFolderName = isFolderNameExist
            ? generateNextName(conversationName, conversationName, folders)
            : conversationName;

          const actions = attachmentsToUpload.map((attachment) => {
            const formData = new FormData();

            if (!attachment.fileContent) {
              return of(
                ImportExportActions.uploadSingleFileFail({
                  id: attachment.id,
                }),
              );
            }

            formData.append(
              'attachment',
              attachment.fileContent,
              attachment.name,
            );
            const { parentPath } = splitEntityId(attachment.id);
            const newParentPath =
              parentPath && parentPath.replace(`${ImportRoot.Imports}/`, '');

            const relativePath = constructPath(
              ImportRoot.Imports,
              rootFolderName,
              newParentPath,
            );

            return FileService.sendFile(
              formData,
              relativePath,
              attachment.name,
            ).pipe(
              filter(
                ({ percent, result }) =>
                  typeof percent !== 'undefined' ||
                  typeof result !== 'undefined',
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
                      oldId: attachment.id,
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
            takeUntil(
              action$.pipe(filter(ImportExportActions.importStop.match)),
            ),
          );
        }),
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
        ImportExportActions.importFail.match(action) ||
        ImportExportActions.importStop.match(action) ||
        ImportExportActions.importPromptsFail.match(action) ||
        PromptsActions.importPromptsSuccess.match(action) ||
        PromptsActions.initPromptsSuccess.match(action),
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
  exportLocalStorageEntitiesEpic,
);
