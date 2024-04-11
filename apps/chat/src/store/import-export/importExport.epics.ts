import {
  EMPTY,
  Observable,
  catchError,
  concat,
  concatMap,
  filter,
  forkJoin,
  from,
  iif,
  map,
  mergeAll,
  mergeMap,
  of,
  switchMap,
  takeUntil,
  tap,
  toArray,
  zip,
} from 'rxjs';

import { AnyAction } from '@reduxjs/toolkit';

import { combineEpics } from 'redux-observable';

import {
  combineEntities,
  filterOnlyMyEntities,
  isImportEntityNameOnSameLevelUnique,
} from '@/src/utils/app/common';
import { BucketService } from '@/src/utils/app/data/bucket-service';
import { ConversationService } from '@/src/utils/app/data/conversation-service';
import { FileService } from '@/src/utils/app/data/file-service';
import { PromptService } from '@/src/utils/app/data/prompt-service';
import {
  getImportPreparedConversations,
  getOrUploadConversation,
} from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { BrowserStorage } from '@/src/utils/app/data/storages/browser-storage';
import { constructPath } from '@/src/utils/app/file';
import {
  getConversationAttachmentWithPath,
  getFoldersFromIds,
  getParentFolderIdsFromFolderId,
} from '@/src/utils/app/folders';
import { getFileRootId } from '@/src/utils/app/id';
import {
  cleanConversationsFolders,
  cleanData,
  cleanPromptsFolders,
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
  updateAttachmentsNames,
} from '@/src/utils/app/zip-import-export';

import { Conversation, Message, Stage } from '@/src/types/chat';
import { FeatureType, UploadStatus } from '@/src/types/common';
import { FolderType } from '@/src/types/folder';
import { ImportRoot, LatestExportFormat } from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';
import { AppEpic } from '@/src/types/store';

import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { getUniqueAttachments } from '../conversations/conversations.selectors';
import { FilesActions } from '../files/files.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import {
  ImportExportActions,
  ImportExportSelectors,
} from './importExport.reducers';

import uniq from 'lodash-es/uniq';

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
        catchError(() =>
          concat(
            of(
              UIActions.showErrorToast(
                translate('An error occurred while uploading conversation'),
              ),
            ),
            of(ImportExportActions.exportFail()),
          ),
        ),
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
      const foldersIds = uniq(
        onlyMyConversationsListing.map((info) => info.folderId),
      );
      //calculate all folders;
      const foldersWithConversation = getFoldersFromIds(
        uniq(foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id))),
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
    switchMap(({ conversations, folders }) => {
      const filteredConversations = conversations.filter(
        Boolean,
      ) as Conversation[];

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportConversations(filteredConversations, folders, appName);
      return EMPTY;
    }),
    catchError(() =>
      concat(
        of(
          UIActions.showErrorToast(
            translate('An error occurred while uploading conversations'),
          ),
        ),
        of(ImportExportActions.exportFail()),
      ),
    ),
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
        appName: of(SettingsSelectors.selectAppName(state$.value)),
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
        appName: of(SettingsSelectors.selectAppName(state$.value)),
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
    switchMap(({ payload }) => {
      const { history, folders, isError } = cleanData(payload.data);
      if (isError) {
        return concat(
          of(UIActions.showErrorToast(errorsMessages.unsupportedDataFormat)),
          of(ImportExportActions.resetState()),
        );
      }

      const preparedConversations = getImportPreparedConversations({
        conversations: history,
        conversationsFolders: folders,
      }) as Conversation[];

      if (!preparedConversations.length) {
        return of(ImportExportActions.importFail());
      }

      return ConversationService.getConversations(undefined, true).pipe(
        switchMap((conversationsListing) => {
          const existedImportNamesConversations = preparedConversations.filter(
            (importConv) =>
              !isImportEntityNameOnSameLevelUnique({
                entity: importConv,
                entities: conversationsListing,
              }),
          );

          const nonExistedImportNamesConversations =
            preparedConversations.filter((importConv) => {
              return isImportEntityNameOnSameLevelUnique({
                entity: importConv,
                entities: conversationsListing,
              });
            });
          const emptyFolders = folders.filter(
            (folder) =>
              !preparedConversations.some(
                (conv) => conv.folderId === folder.id,
              ),
          );
          if (!existedImportNamesConversations.length) {
            return of(
              ImportExportActions.uploadImportedConversations({
                itemsToUpload: nonExistedImportNamesConversations,
                folders: emptyFolders,
              }),
            );
          }

          if (!nonExistedImportNamesConversations.length) {
            return of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesConversations,
                featureType: FeatureType.Chat,
              }),
            );
          }

          return concat(
            of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesConversations,
                featureType: FeatureType.Chat,
              }),
            ),
            of(
              ImportExportActions.uploadImportedConversations({
                itemsToUpload: nonExistedImportNamesConversations,
                folders: emptyFolders,
              }),
            ),
          );
        }),
      );
    }),
    catchError(() => of(ImportExportActions.importFail())),
  );

const handleDuplicatedItemsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.handleDuplicatedItems.match),
    switchMap(({ payload }) => {
      const { itemsToPostfix, itemsToReplace, featureType } = payload;

      const actions: Observable<AnyAction>[] = [];

      if (itemsToReplace.length) {
        actions.push(
          of(
            ImportExportActions.replaceFeatures({
              itemsToReplace,
              featureType,
            }),
          ),
        );
      }

      if (itemsToPostfix.length) {
        if (featureType === FeatureType.Chat) {
          actions.push(
            of(
              ImportExportActions.uploadImportedConversations({
                itemsToUpload: itemsToPostfix as Conversation[],
              }),
            ),
          );
        }

        if (featureType === FeatureType.Prompt) {
          actions.push(
            of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: itemsToPostfix as Prompt[],
              }),
            ),
          );
        }
      }

      return concat(...actions);
    }),
  );

const uploadImportedConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadImportedConversations.match),
    concatMap(({ payload }) => {
      return from(
        ConversationService.setConversations(payload.itemsToUpload),
      ).pipe(
        toArray(),
        switchMap((uploadedConversations) => {
          return ConversationService.getConversations(undefined, true).pipe(
            switchMap((conversationsListing) => {
              if (
                uploadedConversations.length &&
                !conversationsListing.length
              ) {
                return of(ImportExportActions.importFail());
              }

              const foldersIds = uniq(
                conversationsListing.map((info) => info.folderId),
              );
              //calculate all folders;
              const conversationsFolders = getFoldersFromIds(
                uniq(
                  foldersIds.flatMap((id) =>
                    getParentFolderIdsFromFolderId(id),
                  ),
                ),
                FolderType.Chat,
              );

              const cleanFolders = cleanConversationsFolders(
                payload.folders ?? [],
              );

              const newFolders = combineEntities(
                conversationsFolders,
                cleanFolders,
              );

              const firstImportedConversation = uploadedConversations[0];

              const uploadedConversationsFoldersIds = uniq(
                uploadedConversations.map((info) => info.folderId),
              );

              const importedFoldersIds = cleanFolders.map(
                (folder) => folder.id,
              );

              const openedFolderIds = UISelectors.selectOpenedFoldersIds(
                state$.value,
                FeatureType.Chat,
              );

              const numberOfRunningOperations =
                ImportExportSelectors.selectNumberOfRunningOperations(
                  state$.value,
                );
              const isShowReplaceDialog =
                ImportExportSelectors.selectIsShowReplaceDialog(state$.value);
              return concat(
                of(ImportExportActions.decreaseNumberOfRunningOperations()),

                of(
                  ConversationsActions.importConversationsSuccess({
                    conversations: conversationsListing,
                    folders: newFolders,
                  }),
                ),
                of(
                  ConversationsActions.selectConversations({
                    conversationIds: [firstImportedConversation.id],
                  }),
                ),
                of(
                  UIActions.setOpenedFoldersIds({
                    openedFolderIds: uniq([
                      ...uploadedConversationsFoldersIds,
                      ...importedFoldersIds,
                      ...openedFolderIds,
                    ]),
                    featureType: FeatureType.Chat,
                  }),
                ),
                iif(
                  () =>
                    numberOfRunningOperations - 1 <= 0 && !isShowReplaceDialog,
                  of(ImportExportActions.resetState()),
                  EMPTY,
                ),
              );
            }),
            catchError(() => {
              return concat(
                of(
                  UIActions.showErrorToast(
                    translate(
                      'An error occurred while uploading conversations and folders',
                    ),
                  ),
                ),
                of(ImportExportActions.importFail()),
              );
            }),
          ); //listing of all entities
        }),
        catchError(() => of(ImportExportActions.importFail())),
      );
    }),
  );

const uploadImportedPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadImportedPrompts.match),
    switchMap(({ payload }) => {
      const { itemsToUpload, folders } = payload;
      return from(PromptService.setPrompts(itemsToUpload)).pipe(
        toArray(),
        switchMap(() => {
          return PromptService.getPrompts(undefined, true).pipe(
            switchMap((promptsListing) => {
              if (itemsToUpload.length && !promptsListing.length) {
                return of(ImportExportActions.importPromptsFail());
              }

              const foldersIds = uniq(
                promptsListing.map((info) => info.folderId),
              );
              //calculate all folders;
              const promptsFolders = getFoldersFromIds(
                uniq(
                  foldersIds.flatMap((id) =>
                    getParentFolderIdsFromFolderId(id),
                  ),
                ),
                FolderType.Prompt,
              );

              const cleanFolders = cleanPromptsFolders(folders ?? []);

              const newFolders = combineEntities(promptsFolders, cleanFolders);

              const numberOfRunningOperations =
                ImportExportSelectors.selectNumberOfRunningOperations(
                  state$.value,
                );
              const isShowReplaceDialog =
                ImportExportSelectors.selectIsShowReplaceDialog(state$.value);

              return concat(
                of(ImportExportActions.decreaseNumberOfRunningOperations()),
                of(
                  PromptsActions.importPromptsSuccess({
                    prompts: promptsListing,
                    folders: newFolders,
                  }),
                ),

                iif(
                  () =>
                    numberOfRunningOperations - 1 <= 0 && !isShowReplaceDialog,
                  of(ImportExportActions.resetState()),
                  EMPTY,
                ),
              );
            }),
            catchError(() => {
              return concat(
                of(
                  UIActions.showErrorToast(
                    translate(
                      'An error occurred while uploading prompts and folders',
                    ),
                  ),
                ),
                of(ImportExportActions.importPromptsFail()),
              );
            }),
          ); //listing of all entities
        }),
        catchError(() => of(ImportExportActions.importPromptsFail())),
      );
    }),
  );

const replaceFeaturesEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.replaceFeatures.match),
    switchMap(({ payload }) => {
      const actions: Observable<AnyAction>[] = [];

      if (payload.featureType === FeatureType.Chat) {
        const itemsToReplace = payload.itemsToReplace as Conversation[];
        itemsToReplace.forEach((conversation) => {
          actions.push(
            of(
              ImportExportActions.replaceConversation({
                conversation,
              }),
            ),
          );
        });
      }

      if (payload.featureType === FeatureType.Prompt) {
        const itemsToReplace = payload.itemsToReplace as Prompt[];
        itemsToReplace.forEach((prompt) => {
          actions.push(
            of(
              ImportExportActions.replacePrompt({
                prompt: prompt,
              }),
            ),
          );
        });
      }

      return concat(...actions).pipe(
        takeUntil(action$.pipe(filter(ImportExportActions.importStop.match))),
      );
    }),
  );

const replaceConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.replaceConversation.match),

    mergeMap(({ payload }) => {
      const { conversation } = payload;

      const oldConversation =
        ConversationsSelectors.selectDuplicatedConversation(state$.value, {
          importId: conversation.id,
          conversationName: conversation.name,
        });

      if (!oldConversation) {
        return concat(
          of(
            UIActions.showErrorToast(
              translate(
                'It looks like this conversation has been deleted. Please reload the page and try to import it again',
              ),
            ),
          ),
          of(ImportExportActions.importFail()),
        );
      }
      const newConversation: Conversation = {
        ...conversation,
        folderId: oldConversation.folderId,
        id: oldConversation.id,
        status: UploadStatus.UNINITIALIZED,
        lastActivityDate: Date.now(),
      };

      const numberOfRunningOperations =
        ImportExportSelectors.selectNumberOfRunningOperations(state$.value);

      return concat(
        of(ConversationsActions.saveConversation(newConversation)),
        of(
          ConversationsActions.updateConversationSuccess({
            id: oldConversation.id,
            conversation: {
              ...newConversation,
            },
          }),
        ),
        of(ImportExportActions.decreaseNumberOfRunningOperations()),

        iif(
          () => numberOfRunningOperations - 1 <= 0,
          concat(
            of(
              ConversationsActions.selectConversations({
                conversationIds: [newConversation.id],
              }),
            ),

            of(
              UIActions.setOpenedFoldersIds({
                openedFolderIds: [newConversation.folderId],
                featureType: FeatureType.Chat,
              }),
            ),
            of(ImportExportActions.resetState()),
          ),
          EMPTY,
        ),
      );
    }),
  );

const replacePromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.replacePrompt.match),

    mergeMap(({ payload }) => {
      const { prompt } = payload;

      const oldPrompt = PromptsSelectors.selectDuplicatedPrompt(state$.value, {
        importId: prompt.id,
        promptName: prompt.name,
      });

      if (!oldPrompt) {
        return concat(
          of(
            UIActions.showErrorToast(
              translate(
                'It looks like this prompt has been deleted. Please reload the page and try to import it again',
              ),
            ),
          ),
          of(ImportExportActions.importFail()),
        );
      }

      const newPrompt: Prompt = {
        ...prompt,
        folderId: oldPrompt.folderId,
        id: oldPrompt.id,
      };

      const numberOfRunningOperations =
        ImportExportSelectors.selectNumberOfRunningOperations(state$.value);

      return concat(
        of(
          PromptsActions.updatePromptSuccess({
            prompt: newPrompt,
            id: oldPrompt.id,
          }),
        ),
        of(PromptsActions.savePrompt(newPrompt)),
        of(ImportExportActions.decreaseNumberOfRunningOperations()),
        iif(
          () => numberOfRunningOperations - 1 <= 0,
          of(ImportExportActions.resetState()),
          EMPTY,
        ),
      );
    }),
  );

const importZipEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importZipConversations.match),
    switchMap(({ payload }) => {
      return from(importZippedHistory(payload.zipFile)).pipe(
        switchMap((preUnzipedHistory) => {
          const { zip } = preUnzipedHistory;
          if (!preUnzipedHistory.history || !preUnzipedHistory.history.name) {
            return concat(
              of(
                UIActions.showErrorToast(errorsMessages.unsupportedDataFormat),
              ),
              of(ImportExportActions.importFail()),
            );
          }
          const file = zip.file(preUnzipedHistory.history.name);

          if (!file) {
            return concat(
              of(
                UIActions.showErrorToast(errorsMessages.unsupportedDataFormat),
              ),
              of(ImportExportActions.importFail()),
            );
          }

          return from(file.async('string')).pipe(
            switchMap((completeHistoryJson) => {
              const completeHistoryParsed = JSON.parse(completeHistoryJson);
              if (!completeHistoryParsed) {
                return concat(
                  of(
                    UIActions.showErrorToast(
                      errorsMessages.unsupportedDataFormat,
                    ),
                  ),
                  of(ImportExportActions.importFail()),
                );
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
                return concat(
                  of(
                    UIActions.showErrorToast(
                      errorsMessages.unsupportedDataFormat,
                    ),
                  ),
                  of(ImportExportActions.importFail()),
                );
              }

              const attachments = getUniqueAttachments(
                getConversationAttachmentWithPath(
                  cleanConversations[firstConversationIndex],
                  cleanFolders,
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

                  const bucket = BucketService.getBucket();

                  if (!bucket.length) {
                    return of(ImportExportActions.importFail());
                  }

                  const conversation =
                    cleanHistory.history[firstConversationIndex];

                  const importFileFolderPath = constructPath(
                    getFileRootId(),
                    ImportRoot.Imports,
                    conversation.name,
                  );

                  return FileService.getFiles(importFileFolderPath).pipe(
                    switchMap((existedFiles) => {
                      const attachmentsToUploadWithFolder =
                        attachmentsToUpload.map((attachment) => ({
                          ...attachment,
                          folderId: importFileFolderPath,
                        }));

                      const duplicatedFiles =
                        attachmentsToUploadWithFolder.filter((fileToUpload) =>
                          existedFiles.some(
                            (e) => fileToUpload.name === e.name,
                          ),
                        );

                      const nonDuplicatedFiles =
                        attachmentsToUploadWithFolder.filter(
                          (fileToUpload) =>
                            !existedFiles.some(
                              (e) => fileToUpload.name === e.name,
                            ),
                        );

                      return iif(
                        () => !!duplicatedFiles.length,
                        of(
                          ImportExportActions.showReplaceDialog({
                            duplicatedItems: duplicatedFiles,
                            featureType: FeatureType.File,
                            completeHistory: cleanHistory,
                            nonDuplicatedFiles: nonDuplicatedFiles,
                          }),
                        ),
                        of(
                          ImportExportActions.uploadConversationAttachments({
                            attachmentsToPostfix: attachmentsToUpload,
                            completeHistory: cleanHistory,
                          }),
                        ),
                      );
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

const uploadConversationAttachmentsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadConversationAttachments.match),
    switchMap(({ payload }) => {
      const { attachmentsToPostfix, attachmentsToReplace, completeHistory } =
        payload;
      const bucket = BucketService.getBucket();

      if (!bucket.length) {
        return of(ImportExportActions.importFail());
      }

      const conversation = completeHistory.history[firstConversationIndex];

      const importFileFolderPath = constructPath(
        getFileRootId(),
        ImportRoot.Imports,
        conversation.name,
      );

      return FileService.getFiles(importFileFolderPath).pipe(
        switchMap((filesFromFolder) => {
          const nonDuplicatedFiles =
            ImportExportSelectors.selectNonDuplicatedFiles(state$.value);

          const alreadyExistedFiles = [
            ...filesFromFolder,
            ...nonDuplicatedFiles,
          ];

          const updatedAttachments = updateAttachmentsNames({
            filesFromFolder: alreadyExistedFiles,
            attachmentsToPostfix,
          });

          const allAttachments = [
            ...updatedAttachments,
            ...nonDuplicatedFiles,
            ...(attachmentsToReplace ?? []),
          ];

          const actions = allAttachments.map((attachment) => {
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

            const relativePath = constructPath(
              ImportRoot.Imports,
              conversation.name,
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
                  return ImportExportActions.uploadSingleAttachmentSuccess({
                    apiResult: {
                      ...result,
                      oldRelativePath: attachment.id,
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
    switchMap(() => {
      return of(UIActions.showErrorToast(errorsMessages.importFailed));
    }),
  );

const exportFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.exportFail.match),
    switchMap(() => {
      return of(UIActions.showErrorToast(errorsMessages.exportFailed));
    }),
  );

const resetStateEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(
      (action) =>
        ImportExportActions.exportCancel.match(action) ||
        ImportExportActions.exportConversationSuccess.match(action) ||
        ImportExportActions.exportFail.match(action) ||
        ImportExportActions.importFail.match(action) ||
        ImportExportActions.importStop.match(action) ||
        ImportExportActions.importPromptsFail.match(action) ||
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
  uploadImportedConversationsEpic,
  resetStateEpic,
  importFailEpic,
  exportFailEpic,
  checkImportFailEpic,
  exportLocalStorageChatsEpic,
  exportLocalStoragePromptsEpic,
  replaceFeaturesEpic,
  uploadImportedPromptsEpic,
  replaceConversationEpic,
  replacePromptEpic,
  handleDuplicatedItemsEpic,
);
