import toast from 'react-hot-toast';

import {
  EMPTY,
  catchError,
  concat,
  filter,
  from,
  ignoreElements,
  map,
  mergeAll,
  of,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import { combineEpics } from 'redux-observable';

import { DataService } from '@/src/utils/app/data/data-service';
import { getConversationAttachmentWithPath } from '@/src/utils/app/folders';
import {
  ImportConversationsResponse,
  cleanData,
  exportConversation,
  exportConversations,
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
import { LatestExportFormat } from '@/src/types/importExport';
import { AppEpic } from '@/src/types/store';

import { errorsMessages } from '@/src/constants/errors';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '../conversations/conversations.reducers';
import { getUniqueAttachments } from '../conversations/conversations.selectors';
import { FilesActions, FilesSelectors } from '../files/files.reducers';
import { selectFolders } from '../prompts/prompts.selectors';
import {
  ImportExportActions,
  ImportExportSelectors,
} from './importExport.reducers';

const firstConversationIndex = 0;

const exportConversationEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportConversation.match),
    map(({ payload }) => ({
      conversation: ConversationsSelectors.selectConversation(
        state$.value,
        payload.conversationId,
      ),
      withAttachments: payload.withAttachments,
      bucket: FilesSelectors.selectBucket(state$.value),
    })),
    switchMap(({ conversation, withAttachments, bucket }) => {
      if (!conversation) {
        return of(ImportExportActions.exportFail());
      }
      const parentFolders = ConversationsSelectors.selectParentFolders(
        state$.value,
        conversation.folderId,
      );
      if (!withAttachments) {
        exportConversation(conversation, parentFolders);
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
          downloadExportZip(content);
          return of(ImportExportActions.exportConversationSuccess());
        }),
        takeUntil(action$.pipe(filter(ImportExportActions.exportCancel.match))),
      );
    }),
  );

const exportConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.exportConversations.match),
    map(() => ({
      conversations: ConversationsSelectors.selectConversations(state$.value),
      folders: ConversationsSelectors.selectFolders(state$.value),
    })),
    tap(({ conversations, folders }) => {
      exportConversations(conversations, folders);
    }),
    ignoreElements(),
  );

const importConversationsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.importConversations.match),
    switchMap(({ payload }) => {
      const currentConversations = ConversationsSelectors.selectConversations(
        state$.value,
      );
      const currentFolders = ConversationsSelectors.selectFolders(state$.value);
      const { history, folders, isError }: ImportConversationsResponse =
        importConversations(payload.data, {
          currentConversations,
          currentFolders,
        });

      if (isError) {
        toast.error(errorsMessages.unsupportedDataFormat);
        return of(ImportExportActions.resetState());
      }

      return concat(
        of(ImportExportActions.importConversationsSuccess()),
        of(
          ConversationsActions.importConversationsSuccess({
            conversations: history,
            folders,
          }),
        ),
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

const uploadConversationAttachmentsEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadConversationAttachments.match),
    switchMap(({ payload }) => {
      const { attachmentsToUpload, completeHistory } = payload;
      const bucket = FilesSelectors.selectBucket(state$.value);

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
        const relativePath = `imports/${conversation.id}/${attachment.relativePath}`;
        return DataService.sendFile(
          formData,
          bucket,
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
);
