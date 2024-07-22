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
import {
  PromptService,
  getImportPreparedPrompts,
} from '@/src/utils/app/data/prompt-service';
import {
  getImportPreparedConversations,
  getOrUploadConversation,
} from '@/src/utils/app/data/storages/api/conversation-api-storage';
import { getOrUploadPrompt } from '@/src/utils/app/data/storages/api/prompt-api-storage';
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
  exportPrompt,
  exportPrompts,
  getConversationActions,
  getDuplicatedConversations,
  getPromptActions,
  getToastAction,
  isPromptsFormat,
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
import { DialFile } from '@/src/types/files';
import { FolderType } from '@/src/types/folder';
import { LatestExportFormat, ReplaceOptions } from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';
import { AppEpic } from '@/src/types/store';

import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { errorsMessages } from '@/src/constants/errors';
import { successMessages } from '@/src/constants/successMessages';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { getUniqueAttachments } from '../conversations/conversations.selectors';
import { FilesActions } from '../files/files.reducers';
import { MigrationActions } from '../migration/migration.reducers';
import { SettingsSelectors } from '../settings/settings.reducers';
import { UIActions, UISelectors } from '../ui/ui.reducers';
import {
  ImportExportActions,
  ImportExportSelectors,
} from './importExport.reducers';

import uniq from 'lodash-es/uniq';

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportConversation.match),
    switchMap(({ payload }) =>
      forkJoin({
        conversation: getOrUploadConversation(
          { id: payload.conversationId },
          state$.value,
        ).pipe(map((data) => data.conversation)),
        withAttachments: of(payload.withAttachments),
        bucket: BucketService.getBucket(),
      }),
    ),
    switchMap(({ conversation, withAttachments, bucket }) => {
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
                translate(errorsMessages.uploadingConversationsError),
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
            translate(errorsMessages.uploadingConversationsError),
          ),
        ),
        of(ImportExportActions.exportFail()),
      ),
    ),
  );

const exportPromptEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportPrompt.match),
    switchMap(({ payload }) => getOrUploadPrompt(payload, state$.value)),

    switchMap((promptAndPayload) => {
      const { prompt } = promptAndPayload;
      if (!prompt) {
        return concat(
          of(
            UIActions.showErrorToast(
              translate(errorsMessages.uploadingPromptsError),
            ),
          ),
          of(ImportExportActions.exportFail()),
        );
      }

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportPrompt(
        prompt,
        PromptsSelectors.selectParentFolders(state$.value, prompt.folderId),
        appName,
      );
      return EMPTY;
    }),
  );

const exportPromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportPrompts.match),
    switchMap(() =>
      //listing of all entities
      PromptService.getPrompts(undefined, true),
    ),
    switchMap((promptsListing) => {
      const onlyMyPromptsListing = filterOnlyMyEntities(promptsListing);
      const foldersIds = uniq(
        onlyMyPromptsListing.map((info) => info.folderId),
      );
      //calculate all folders;
      const foldersWithPrompts = getFoldersFromIds(
        uniq(foldersIds.flatMap((id) => getParentFolderIdsFromFolderId(id))),
        FolderType.Prompt,
      );

      const allFolders = PromptsSelectors.selectFolders(state$.value);

      const folders = combineEntities(foldersWithPrompts, allFolders);

      return forkJoin({
        //get all prompts from api
        prompts: zip(
          onlyMyPromptsListing.map((info) => PromptService.getPrompt(info)),
        ),
        folders: of(folders),
      });
    }),
    switchMap(({ prompts, folders }) => {
      const filteredPrompts = prompts.filter(Boolean) as Prompt[];

      const appName = SettingsSelectors.selectAppName(state$.value);

      exportPrompts(filteredPrompts, folders, appName);
      return EMPTY;
    }),
    catchError(() =>
      concat(
        of(
          UIActions.showErrorToast(
            translate(errorsMessages.uploadingPromptsError),
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
      of(MigrationActions.setIsChatsBackedUp({ isChatsBackedUp: true })),
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
      of(MigrationActions.setIsPromptsBackedUp({ isPromptsBackedUp: true })),
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
          of(
            UIActions.showErrorToast(
              errorsMessages.unsupportedConversationsDataFormat,
            ),
          ),
          of(ImportExportActions.resetState()),
        );
      }

      const preparedConversations = getImportPreparedConversations({
        conversations: history,
        conversationsFolders: folders,
      }) as Conversation[];

      if (!preparedConversations.length) {
        return of(ImportExportActions.importFail(FeatureType.Chat));
      }

      return getDuplicatedConversations(preparedConversations).pipe(
        mergeMap(({ newConversations, duplicatedConversations }) => {
          return concat(
            iif(
              () => !!duplicatedConversations.length,
              of(
                ImportExportActions.showReplaceDialog({
                  duplicatedItems: duplicatedConversations,
                  featureType: FeatureType.Chat,
                }),
              ),
              EMPTY,
            ),
            iif(
              () => !!newConversations.length,
              of(
                ImportExportActions.uploadImportedConversations({
                  itemsToUpload: newConversations,
                }),
              ),
              EMPTY,
            ),
          );
        }),
      );
    }),
    catchError(() => of(ImportExportActions.importFail(FeatureType.Chat))),
  );

const importPromptsEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importPrompts.match),
    switchMap(({ payload }) => {
      const { promptsHistory } = payload;

      if (!isPromptsFormat(promptsHistory)) {
        return concat(
          of(ImportExportActions.importPromptsFail()),
          of(
            UIActions.showErrorToast(
              translate(errorsMessages.unsupportedPromptsDataFormat, {
                ns: 'common',
              }),
            ),
          ),
        );
      }

      const preparedPrompts: Prompt[] = getImportPreparedPrompts({
        prompts: promptsHistory.prompts,
        folders: promptsHistory.folders,
      });

      if (!preparedPrompts.length) {
        return of(ImportExportActions.importPromptsFail());
      }

      return PromptService.getPrompts(undefined, true).pipe(
        switchMap((promptsListing) => {
          const existedImportNamesPrompts = preparedPrompts.filter(
            (importPrompt) =>
              !isImportEntityNameOnSameLevelUnique({
                entity: importPrompt,
                entities: promptsListing,
              }),
          );

          const nonExistedImportNamesPrompts = preparedPrompts.filter(
            (importPrompt) => {
              return isImportEntityNameOnSameLevelUnique({
                entity: importPrompt,
                entities: promptsListing,
              });
            },
          );

          const emptyFolders = promptsHistory.folders.filter(
            (folder) =>
              !preparedPrompts.some((conv) => conv.folderId === folder.id),
          );

          if (!existedImportNamesPrompts.length) {
            return of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: nonExistedImportNamesPrompts,
                folders: emptyFolders,
              }),
            );
          }

          if (!nonExistedImportNamesPrompts.length) {
            return of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesPrompts,
                featureType: FeatureType.Prompt,
              }),
            );
          }

          return concat(
            of(
              ImportExportActions.showReplaceDialog({
                duplicatedItems: existedImportNamesPrompts,
                featureType: FeatureType.Prompt,
              }),
            ),
            of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: nonExistedImportNamesPrompts,
                folders: emptyFolders,
              }),
            ),
          );
        }),
        catchError(() => of(ImportExportActions.importPromptsFail())),
      );
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
                return of(ImportExportActions.importFail(FeatureType.Chat));
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

              const isShowReplaceDialog =
                ImportExportSelectors.selectIsShowReplaceDialog(state$.value);
              return concat(
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
                  () => !isShowReplaceDialog,
                  concat(
                    of(ImportExportActions.resetState()),
                    of(
                      UIActions.showSuccessToast(
                        translate(
                          `Conversation(s) ${successMessages.importSuccess}`,
                        ),
                      ),
                    ),
                  ),
                  EMPTY,
                ),
              );
            }),
            catchError(() => {
              return concat(
                of(
                  UIActions.showErrorToast(
                    translate(errorsMessages.uploadingConversationsError),
                  ),
                ),
                of(ImportExportActions.importFail(FeatureType.Chat)),
              );
            }),
          ); //listing of all entities
        }),
        catchError(() => of(ImportExportActions.importFail(FeatureType.Chat))),
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

              const isShowReplaceDialog =
                ImportExportSelectors.selectIsShowReplaceDialog(state$.value);

              return concat(
                of(
                  PromptsActions.importPromptsSuccess({
                    prompts: promptsListing,
                    folders: newFolders,
                  }),
                ),

                iif(
                  () => !isShowReplaceDialog,
                  concat(
                    of(ImportExportActions.resetState()),
                    of(
                      UIActions.showSuccessToast(
                        translate(`Prompt(s) ${successMessages.importSuccess}`),
                      ),
                    ),
                  ),
                  EMPTY,
                ),
              );
            }),
            catchError(() => {
              return concat(
                of(
                  UIActions.showErrorToast(
                    translate(errorsMessages.uploadingPromptsError),
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

const continueDuplicatedImportEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.continueDuplicatedImport.match),
    switchMap(({ payload }) => {
      const actions: Observable<AnyAction>[] = [];
      const featureType = ImportExportSelectors.selectFeatureType(state$.value);

      if (featureType === FeatureType.Chat) {
        const duplicatedConversations =
          ImportExportSelectors.selectDuplicatedConversations(state$.value);

        const conversationsToPostfix: Conversation[] = [];
        const conversationsToReplace: Conversation[] = [];
        duplicatedConversations?.forEach((conversation) => {
          if (
            payload.mappedActions[conversation.id] === ReplaceOptions.Postfix
          ) {
            conversationsToPostfix.push(conversation);
          }

          if (
            payload.mappedActions[conversation.id] === ReplaceOptions.Replace
          ) {
            conversationsToReplace.push(conversation);
          }
        });

        if (conversationsToPostfix.length) {
          actions.push(
            of(
              ImportExportActions.uploadImportedConversations({
                itemsToUpload: conversationsToPostfix,
              }),
            ),
          );
        }

        if (conversationsToReplace.length) {
          actions.push(
            of(
              ImportExportActions.replaceConversations({
                conversations: conversationsToReplace,
              }),
            ),
          );
        }
      }

      if (featureType === FeatureType.Prompt) {
        const duplicatedPrompts = ImportExportSelectors.selectDuplicatedPrompts(
          state$.value,
        );

        const promptsToPostfix: Prompt[] = [];
        const promptsToReplace: Prompt[] = [];

        duplicatedPrompts?.forEach((prompt) => {
          if (payload.mappedActions[prompt.id] === ReplaceOptions.Postfix) {
            promptsToPostfix.push(prompt);
          }

          if (payload.mappedActions[prompt.id] === ReplaceOptions.Replace) {
            promptsToReplace.push(prompt);
          }
        });

        if (promptsToReplace.length) {
          actions.push(
            of(
              ImportExportActions.replacePrompts({
                prompts: promptsToReplace,
              }),
            ),
          );
        }

        if (promptsToPostfix.length) {
          actions.push(
            of(
              ImportExportActions.uploadImportedPrompts({
                itemsToUpload: promptsToPostfix,
              }),
            ),
          );
        }
      }

      if (featureType === FeatureType.File) {
        const duplicatedFiles = ImportExportSelectors.selectDuplicatedFiles(
          state$.value,
        );

        const attachmentsToPostfix: DialFile[] = [];
        const attachmentsToReplace: DialFile[] = [];
        const ignoredAttachmentsIds: string[] = [];

        duplicatedFiles.forEach((file) => {
          if (payload.mappedActions[file.id] === ReplaceOptions.Postfix) {
            attachmentsToPostfix.push(file);
          }

          if (payload.mappedActions[file.id] === ReplaceOptions.Replace) {
            attachmentsToReplace.push(file);
          }

          if (payload.mappedActions[file.id] === ReplaceOptions.Ignore) {
            ignoredAttachmentsIds.push(file.id);
          }
        });

        if (!attachmentsToPostfix.length && !attachmentsToReplace.length) {
          actions.push(
            of(ImportExportActions.updateConversationWithUploadedAttachments()),
          );
        } else {
          actions.push(
            of(
              ImportExportActions.uploadConversationAttachments({
                attachmentsToPostfix,
                attachmentsToReplace,
                ignoredAttachmentsIds,
              }),
            ),
          );
        }
      }

      return concat(...actions).pipe(
        takeUntil(action$.pipe(filter(ImportExportActions.importStop.match))),
      );
    }),
  );

const replaceConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.replaceConversations.match),
    switchMap(({ payload }) => {
      const actions: Observable<AnyAction>[] = [];
      const { conversations } = payload;

      const [modifiedConversations, conversationsNamesWithErrors] =
        conversations.reduce(
          (
            acc: [Conversation[], string[]],
            conversation: Conversation,
          ): [Conversation[], string[]] => {
            const [conversationsAcc, errorsAcc] = acc;
            const oldConversation =
              ConversationsSelectors.selectDuplicatedConversation(
                state$.value,
                {
                  importId: conversation.id,
                  conversationName: conversation.name,
                },
              );

            if (oldConversation) {
              return [
                [
                  ...conversationsAcc,
                  {
                    ...conversation,
                    folderId: oldConversation.folderId,
                    id: oldConversation.id,
                    status: UploadStatus.UNINITIALIZED,
                    lastActivityDate: Date.now(),
                  },
                ],
                errorsAcc,
              ];
            } else {
              return [conversationsAcc, [...errorsAcc, conversation.name]];
            }
          },
          [[], []],
        );

      const conversationActions = modifiedConversations.flatMap(
        (conversation, index) => getConversationActions(conversation, index),
      );

      actions.push(
        ...conversationActions,
        of(ImportExportActions.resetState()),
      );
      actions.push(
        getToastAction(conversationsNamesWithErrors, 'Conversation'),
      );

      return concat(...actions);
    }),
  );

const replacePromptsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.replacePrompts.match),

    switchMap(({ payload }) => {
      const actions: Observable<AnyAction>[] = [];

      const { prompts } = payload;

      const [modifiedPrompts, promptsNamesWithErrors] = prompts.reduce(
        (acc: [Prompt[], string[]], prompt: Prompt): [Prompt[], string[]] => {
          const [promptsAcc, errorsAcc] = acc;
          const oldPrompt = PromptsSelectors.selectDuplicatedPrompt(
            state$.value,
            {
              importId: prompt.id,
              promptName: prompt.name,
            },
          );

          if (oldPrompt) {
            return [
              [
                ...promptsAcc,
                {
                  ...prompt,
                  folderId: oldPrompt.folderId,
                  id: oldPrompt.id,
                  status: UploadStatus.UNINITIALIZED,
                },
              ],
              errorsAcc,
            ];
          } else {
            return [promptsAcc, [...errorsAcc, prompt.name]];
          }
        },
        [[], []],
      );

      const promptActions = modifiedPrompts.flatMap((prompt, index) =>
        getPromptActions(prompt, index),
      );

      actions.push(...promptActions, of(ImportExportActions.resetState()));
      actions.push(getToastAction(promptsNamesWithErrors, 'Prompt'));

      return concat(...actions);
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
                UIActions.showErrorToast(
                  errorsMessages.unsupportedConversationsDataFormat,
                ),
              ),
              of(ImportExportActions.importFail(FeatureType.Chat)),
            );
          }
          const file = zip.file(preUnzipedHistory.history.name);

          if (!file) {
            return concat(
              of(
                UIActions.showErrorToast(
                  errorsMessages.unsupportedConversationsDataFormat,
                ),
              ),
              of(ImportExportActions.importFail(FeatureType.Chat)),
            );
          }

          return from(file.async('string')).pipe(
            switchMap((completeHistoryJson) => {
              const completeHistoryParsed = JSON.parse(completeHistoryJson);
              if (!completeHistoryParsed) {
                return concat(
                  of(
                    UIActions.showErrorToast(
                      errorsMessages.unsupportedConversationsDataFormat,
                    ),
                  ),
                  of(ImportExportActions.importFail(FeatureType.Chat)),
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
                      errorsMessages.unsupportedConversationsDataFormat,
                    ),
                  ),
                  of(ImportExportActions.importFail(FeatureType.Chat)),
                );
              }

              const attachments = getUniqueAttachments(
                getConversationAttachmentWithPath(
                  cleanConversations[0],
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
                    return of(ImportExportActions.importFail(FeatureType.Chat));
                  }

                  const bucket = BucketService.getBucket();

                  if (!bucket.length) {
                    return of(ImportExportActions.importFail(FeatureType.Chat));
                  }

                  const importFileFolderPaths = uniq(
                    attachmentsToUpload.map((a) =>
                      constructPath(getFileRootId(), a.relativePath),
                    ),
                  );

                  const fileObservables = importFileFolderPaths.map(
                    (folderPath) => FileService.getFiles(folderPath),
                  );

                  return forkJoin(fileObservables).pipe(
                    switchMap((allExistedFiles) => {
                      const existedFiles = allExistedFiles.flat();

                      const attachmentsToUploadWithFolder =
                        attachmentsToUpload.map((attachment) => ({
                          ...attachment,
                          folderId: constructPath(
                            getFileRootId(),
                            attachment.relativePath,
                          ),
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

                      const preparedConversations =
                        getImportPreparedConversations({
                          conversations: cleanConversations,
                          conversationsFolders: cleanFolders,
                        }) as Conversation[];

                      if (!preparedConversations.length) {
                        return of(
                          ImportExportActions.importFail(FeatureType.Chat),
                        );
                      }

                      return getDuplicatedConversations(
                        preparedConversations,
                      ).pipe(
                        mergeMap(
                          ({ newConversations, duplicatedConversations }) => {
                            if (
                              duplicatedFiles.length ||
                              duplicatedConversations.length
                            ) {
                              //replace dialog with all together
                              return of(
                                ImportExportActions.showAttachmentsReplaceDialog(
                                  {
                                    duplicatedAttachments: duplicatedFiles,
                                    duplicatedConversations,
                                    nonDuplicatedConversations:
                                      newConversations,
                                    nonDuplicatedFiles: nonDuplicatedFiles,
                                  },
                                ),
                              );
                            }
                            return of(
                              ImportExportActions.uploadConversationAttachments(
                                {
                                  attachmentsToPostfix: attachmentsToUpload,
                                  importedConversations: newConversations,
                                },
                              ),
                            );
                          },
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
      const { attachmentsToPostfix, attachmentsToReplace } = payload;
      const bucket = BucketService.getBucket();

      if (!bucket.length) {
        return of(ImportExportActions.importFail(FeatureType.Chat));
      }

      const importFileFolderPaths = uniq(
        [...attachmentsToPostfix, ...(attachmentsToReplace ?? [])].map((a) =>
          constructPath(getFileRootId(), a.relativePath),
        ),
      );

      const fileObservables = importFileFolderPaths.map((folderPath) =>
        FileService.getFiles(folderPath),
      );

      return forkJoin(fileObservables).pipe(
        switchMap((filesFromAllFolders) => {
          const nonDuplicatedFiles =
            ImportExportSelectors.selectNonDuplicatedFiles(state$.value);

          const alreadyExistedFiles = [
            ...filesFromAllFolders.flat(),
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

            return FileService.sendFile(
              formData,
              attachment.relativePath,
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

      attachmentsErrors: ImportExportSelectors.selectAttachmentsErrors(
        state$.value,
      ),
      ignoredAttachmentsIds: ImportExportSelectors.selectIgnoredAttachmentsIds(
        state$.value,
      ),
    })),
    switchMap((payload) => {
      const {
        attachmentsToUpload,
        uploadedAttachments,
        attachmentsErrors,
        ignoredAttachmentsIds,
      } = payload;

      if (!uploadedAttachments.length && !ignoredAttachmentsIds?.length) {
        return of(ImportExportActions.importFail(FeatureType.Chat));
      }

      if (attachmentsErrors.length) {
        return of(ImportExportActions.importFail(FeatureType.Chat));
      }

      if (
        attachmentsToUpload.length &&
        attachmentsToUpload.length === uploadedAttachments.length
      ) {
        return of(
          ImportExportActions.updateConversationWithUploadedAttachments(),
        );
      }
      return EMPTY;
    }),
  );

const updateConversationWithUploadedAttachmentsEpic: AppEpic = (
  action$,
  state$,
) =>
  action$.pipe(
    filter(ImportExportActions.updateConversationWithUploadedAttachments.match),

    map(() => ({
      uploadedAttachments: ImportExportSelectors.selectUploadedAttachments(
        state$.value,
      ),
      duplicatedConversations:
        ImportExportSelectors.selectDuplicatedConversations(state$.value),
      importedConversations: ImportExportSelectors.selectImportedConversations(
        state$.value,
      ),
      mappedActions: ImportExportSelectors.selectMappedActions(state$.value),
    })),
    switchMap(
      ({
        uploadedAttachments,
        duplicatedConversations,
        importedConversations,
        mappedActions,
      }) => {
        if (!importedConversations.length && !duplicatedConversations?.length) {
          return concat(
            of(
              UIActions.showSuccessToast(
                translate(successMessages.importAttachmentsSuccess),
              ),
            ),
            of(ImportExportActions.resetState()),
          );
        }
        const conversationToUpload =
          importedConversations[0] ?? duplicatedConversations?.[0];

        const duplicateAction = mappedActions?.[conversationToUpload.id];

        if (duplicateAction === ReplaceOptions.Ignore) {
          return concat(
            of(
              UIActions.showSuccessToast(
                translate(
                  successMessages.importAttachmentsSuccessConversationIgnored,
                ),
              ),
            ),
            of(ImportExportActions.resetState()),
          );
        }

        const updatedMessages: Message[] = conversationToUpload.messages.map(
          (message) => {
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
          },
        );

        const updatedConversation: Conversation = {
          ...conversationToUpload,
          messages: updatedMessages,
        };

        if (duplicateAction === ReplaceOptions.Replace) {
          return of(
            ImportExportActions.replaceConversations({
              conversations: [updatedConversation],
            }),
          );
        }

        return of(
          ImportExportActions.uploadImportedConversations({
            itemsToUpload: [updatedConversation],
          }),
        );
      },
    ),
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
        return of(ImportExportActions.importFail(FeatureType.Chat));
      }
      return EMPTY;
    }),
  );

const importFailEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ImportExportActions.importFail.match),
    switchMap(({ payload }) => {
      return of(
        UIActions.showErrorToast(
          payload === FeatureType.Chat
            ? errorsMessages.importConversationsFailed
            : errorsMessages.importPromptsFailed,
        ),
      );
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
        PromptsActions.importPromptsSuccess.match(action) ||
        PromptsActions.initFoldersAndPromptsSuccess.match(action),
    ),
    switchMap(() => {
      return of(ImportExportActions.resetState());
    }),
  );

export const ImportExportEpics = combineEpics(
  exportConversationEpic,
  exportConversationsEpic,
  exportPromptEpic,
  exportPromptsEpic,
  importConversationsEpic,
  importPromptsEpic,
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
  uploadImportedPromptsEpic,
  continueDuplicatedImportEpic,
  updateConversationWithUploadedAttachmentsEpic,
  replaceConversationsEpic,
  replacePromptsEpic,
);
