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
  exportConversation,
  exportConversations,
  importConversations,
} from '@/src/utils/app/import-export';
import {
  compressConversationInZip,
  downloadExportZip,
  getUnZipAttachments,
  importZippedHistory,
} from '@/src/utils/app/zip-import-export';

import { Conversation, Message } from '@/src/types/chat';
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
          const getHistory = async () => {
            const file = await zip
              .file(preUnzipedHistory.history.name)
              ?.async('string');
            if (!file) {
              return;
            }
            const completeHistory = await JSON.parse(file);

            return completeHistory as LatestExportFormat;
          };
          return from(getHistory()).pipe(
            switchMap((completeHistory) => {
              if (!completeHistory) {
                return EMPTY;
              }
              const conversationId = completeHistory.history[0].id;
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
                new Set([...foldersLocal, ...completeHistory.folders]),
              );

              const attachments = getUniqueAttachments(
                getConversationAttachmentWithPath(
                  completeHistory.history[0],
                  folders,
                ),
              );
              if (!attachments.length) {
                return of(
                  ImportExportActions.importConversations({
                    data: completeHistory,
                  }),
                );
              }
              return from(
                getUnZipAttachments({ attachments, preUnzipedHistory }),
              ).pipe(
                switchMap((attachmentsToUpload) => {
                  return of(
                    ImportExportActions.uploadConversationAttachments({
                      attachmentsToUpload,
                      completeHistory,
                    }),
                  );
                }),
              );
            }),
          );
        }),
      );
    }),
    takeUntil(action$.pipe(filter(ImportExportActions.importStop.match))),
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
      const conversation = completeHistory.history[0];

      const actions = attachmentsToUpload.map((attachment) => {
        const formData = new FormData();
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
              const { id, name, absolutePath, relativePath, status, percent } =
                result;
              return ImportExportActions.uploadSingleAttachmentSuccess({
                apiResult: {
                  id,
                  name,
                  absolutePath,
                  relativePath,
                  status,
                  percent,
                },
              });
            }

            return FilesActions.uploadFileTick({
              id: attachment.id,
              percent: percent!,
            });
          }),
          takeUntil(action$.pipe(filter(ImportExportActions.importStop.match))),
          catchError(() => {
            return of(
              ImportExportActions.uploadSingleFileFail({
                id: attachment.id,
              }),
            );
          }),
        );
      });
      mergeAll(1);
      return concat(...actions);
    }),
  );

const uploadAllAttachmentsSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ImportExportActions.uploadSingleAttachmentSuccess.match),
    map(() => ({
      attachmentsToUpload: ImportExportSelectors.selectAttachmentsIdsToUpload(
        state$.value,
      ),
      loadedAttachments: ImportExportSelectors.selectUploadedAttachments(
        state$.value,
      ),

      loadedHistory: ImportExportSelectors.selectImportedHistory(state$.value),
    })),
    switchMap((payload) => {
      const { attachmentsToUpload, loadedAttachments, loadedHistory } = payload;

      if (!loadedAttachments.length) {
        return EMPTY;
      }

      if (
        attachmentsToUpload.length &&
        attachmentsToUpload.length === loadedAttachments.length
      ) {
        const updatedMessages: Message[] =
          loadedHistory.history[0].messages.map((message) => {
            if (!message.custom_content?.attachments) {
              return message;
            }

            const newAttachments = message.custom_content.attachments.map(
              (attachment) => {
                if (!attachment.url) {
                  return attachment;
                }

                const regExp = /files\/\w*\//;
                const attachmentId = decodeURI(attachment.url).split(regExp)[1];

                const newAttachment = loadedAttachments.find(
                  (attachment) => attachment.id === attachmentId,
                );

                if (!newAttachment) {
                  return attachment;
                }

                return {
                  ...attachment,
                  url: encodeURI(
                    `${newAttachment.absolutePath}/${newAttachment.name}`,
                  ),
                };
              },
            );

            const newCustomContent: Message['custom_content'] = {
              ...message.custom_content,
              attachments: newAttachments,
            };
            return {
              ...message,
              custom_content: newCustomContent,
            };
          });

        const updatedConversation: Conversation = {
          ...loadedHistory.history[0],
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
