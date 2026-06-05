import {
  EMPTY,
  catchError,
  concat,
  from,
  map,
  mergeMap,
  of,
  switchMap,
} from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { buildContentWithTranscriptAtSelection } from '@/src/utils/app/common';
import { ApplicationService } from '@/src/utils/app/data/application-service';
import {
  createVoiceQuickAttachment,
  readBlobAsBase64,
  requestAudioTranscription,
  sendMessage,
} from '@/src/utils/app/epics-helpers/chat.epic-helpers';
import { getUserCustomContent } from '@/src/utils/app/file';
import {
  isConversationId,
  isEntityIdExternal,
  isPromptId,
} from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';
import { Translation } from '@/src/types/translation';

import {
  ChatActions,
  ConversationsActions,
  FilesActions,
  PromptsActions,
  UIActions,
} from '@/src/store/actions';
import {
  ChatSelectors,
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Message, Role } from '@epam/ai-dial-shared';

const setFormValueEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.setFormValue.type),
    switchMap(({ payload }) => {
      if (!payload.submit) return EMPTY;

      const selectedFiles = FilesSelectors.selectSelectedFiles(state$.value);
      const selectedFolders = FilesSelectors.selectSelectedFolders(
        state$.value,
      );
      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);
      const formValue = ChatSelectors.selectChatFormValue(state$.value);
      const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
      const configurationSchema =
        ChatSelectors.selectConfigurationSchemaByModelId(
          state$.value,
          payload.modelId,
          modelsMap,
        );
      const content = ChatSelectors.selectInputContent(state$.value);

      const isFirstMessage = !selectedConversations[0].messages.length;

      const message: Message = {
        role: Role.User,
        content,
        custom_content: {
          ...getUserCustomContent(selectedFiles, selectedFolders),
          ...(isFirstMessage
            ? {
                configuration_value: formValue,
                configuration_schema: configurationSchema,
              }
            : {
                form_value: formValue,
              }),
        },
      };

      return sendMessage(
        selectedConversations,
        message,
        ChatActions.resetFormValue(),
      );
    }),
  );

const getConfigurationSchemaEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.getConfigurationSchema.type),
    mergeMap(({ payload }) => {
      const { modelId, replaceExisting } = payload;
      const modelsMap = ModelsSelectors.selectModelsMap(state$.value);
      const uploadedConfigurationSchema =
        ChatSelectors.selectConfigurationSchemaByModelId(
          state$.value,
          modelId,
          modelsMap,
        );
      const loadingConfigurationSchemas =
        ChatSelectors.selectLoadingConfigurationSchemas(state$.value);

      if (
        !replaceExisting &&
        (uploadedConfigurationSchema ||
          loadingConfigurationSchemas.includes(modelId))
      ) {
        return EMPTY;
      }

      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);
      const savedConfigurationSchemas = selectedConversations
        .map(
          (conversation) =>
            conversation.messages?.[0]?.custom_content?.configuration_schema,
        )
        .filter((schema) => schema !== undefined);

      if (savedConfigurationSchemas.length) {
        return concat(
          ...savedConfigurationSchemas.map((schema) =>
            of(
              ChatActions.getConfigurationSchemaSuccess({
                modelId,
                schema,
              }),
            ),
          ),
        );
      }

      return of(
        ChatActions.startConfigurationSchemaUploading({
          modelId: payload.modelId,
        }),
      );
    }),
  );

const startConfigurationSchemaUploadingEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.startConfigurationSchemaUploading.type),
    mergeMap(({ payload }) => {
      return ApplicationService.getConfigurationSchema(payload.modelId).pipe(
        switchMap((schema) => {
          return of(
            ChatActions.getConfigurationSchemaSuccess({
              modelId: payload.modelId,
              schema,
            }),
          );
        }),
        catchError(() => {
          return of(
            ChatActions.getConfigurationSchemaFailed({
              modelId: payload.modelId,
            }),
          );
        }),
      );
    }),
  );

const getConfigurationSchemaFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.getConfigurationSchemaFailed.type),
    map(() => {
      return UIActions.showErrorToast({
        message: translate(ChatI18nKeys.FailedToLoadChatStarters, {
          ns: Translation.Chat,
        }),
      });
    }),
  );

const appendInputContentEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.appendInputContent.type),
    map(() => ChatActions.setShouldFocusAndScroll(true)),
  );

const getEntityInfoEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.getEntityInfo.type),
    switchMap(({ payload }) => {
      const { createdAt, updatedAt, author, id: entityId } = payload.entityInfo;
      const isExternal = isEntityIdExternal({ id: entityId });

      if (createdAt && updatedAt && (!isExternal || author)) {
        return of(
          ChatActions.getEntityInfoSuccess({
            entityInfo: {
              id: entityId,
              createdAt,
              updatedAt,
              author,
            },
          }),
        );
      }

      if (isConversationId(entityId)) {
        return of(
          ConversationsActions.getConversationMetadata({
            conversationId: payload.entityInfo.id,
            withModal: true,
          }),
        );
      }
      if (isPromptId(entityId)) {
        return of(
          PromptsActions.getPromptMetadata({
            promptId: payload.entityInfo.id,
          }),
        );
      }

      return of(
        ChatActions.getEntityInfoFail({
          errorText: ChatI18nKeys.CouldNotGetEntityInfoUnknownEntity,
        }),
      );
    }),
  );

const getEntityInfoFailEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.getEntityInfoFail.type),
    switchMap(({ payload }) => {
      return concat(
        of(ChatActions.resetInfoModal()),
        of(
          UIActions.showErrorToast({
            message: translate(payload.errorText, { ns: Translation.Chat }),
          }),
        ),
      );
    }),
  );

const handleVoiceRecordingEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.handleVoiceRecording.type),
    switchMap(({ payload }) => {
      const { audioBlob, fileExtension } = payload;
      const isAsrMode = ConversationsSelectors.selectIsAsrMode(state$.value);

      if (isAsrMode) {
        return from(readBlobAsBase64(audioBlob)).pipe(
          switchMap((base64Data) => {
            if (!base64Data) return EMPTY;
            return of(
              ChatActions.startTranscription({
                audioData: base64Data,
                mimeType: audioBlob.type,
              }),
            );
          }),
        );
      }

      const { file, fileId, relativePath, fileName } =
        createVoiceQuickAttachment(audioBlob, fileExtension);

      return concat(
        of(
          FilesActions.uploadFile({
            fileContent: file,
            id: fileId,
            relativePath,
            name: fileName,
          }),
        ),
        of(FilesActions.selectFiles({ ids: [fileId] })),
      );
    }),
  );

const handleUserMessageVoiceRecordingEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.handleUserMessageVoiceRecording.type),
    switchMap(({ payload }) => {
      const { audioBlob, fileExtension } = payload;
      const isAsrMode = ConversationsSelectors.selectIsAsrMode(state$.value);

      if (isAsrMode) {
        return concat(
          of(ChatActions.startUserMessageTranscription()),
          from(readBlobAsBase64(audioBlob)).pipe(
            switchMap((base64Data) => {
              if (!base64Data) {
                return of(ChatActions.userMessageTranscriptionFailed());
              }

              return from(
                requestAudioTranscription(base64Data, audioBlob.type),
              ).pipe(
                switchMap(({ transcript, isTooLarge }) =>
                  transcript?.trim()
                    ? of(
                        ChatActions.setUserMessageTranscript(transcript.trim()),
                      )
                    : of(
                        ChatActions.userMessageTranscriptionFailed({
                          isTooLarge,
                        }),
                      ),
                ),
                catchError(() =>
                  of(ChatActions.userMessageTranscriptionFailed()),
                ),
              );
            }),
            catchError(() => of(ChatActions.userMessageTranscriptionFailed())),
          ),
        );
      }

      const { file, fileId, relativePath, fileName } =
        createVoiceQuickAttachment(audioBlob, fileExtension);

      return concat(
        of(
          FilesActions.uploadFile({
            fileContent: file,
            id: fileId,
            relativePath,
            name: fileName,
          }),
        ),
        of(ChatActions.setUserMessageVoiceAttachmentId(fileId)),
      );
    }),
  );

const startTranscriptionEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.startTranscription.type),
    switchMap(({ payload }) => {
      const { audioData, mimeType } = payload;

      return from(requestAudioTranscription(audioData, mimeType)).pipe(
        switchMap(({ transcript, isTooLarge }) => {
          if (!transcript) {
            return of(ChatActions.transcriptionFailed({ isTooLarge }));
          }

          return of(
            ChatActions.transcriptionSuccess({
              transcript,
            }),
          );
        }),
        catchError(() => of(ChatActions.transcriptionFailed())),
      );
    }),
  );

const transcriptionSuccessEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.transcriptionSuccess.type),
    switchMap(({ payload }) => {
      const { transcript } = payload;
      if (!transcript.trim()) {
        return concat(
          of(ChatActions.clearAsrInsertionContext()),
          of(
            UIActions.showErrorToast({
              message: translate(ChatI18nKeys.TranscriptionFailed),
            }),
          ),
        );
      }

      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);

      if (!selectedConversations.length) {
        return of(ChatActions.clearAsrInsertionContext());
      }

      const asrInsertionContext = ChatSelectors.selectAsrInsertionContext(
        state$.value,
      );
      const baseInput =
        asrInsertionContext?.inputSnapshot ??
        ChatSelectors.selectInputContent(state$.value);
      const selection = asrInsertionContext?.selection ?? {
        start: baseInput.length,
        end: baseInput.length,
      };
      const combinedContent = buildContentWithTranscriptAtSelection(
        baseInput,
        transcript,
        selection,
      );

      const selectedFiles = FilesSelectors.selectSelectedFiles(state$.value);
      const selectedFolders = FilesSelectors.selectSelectedFolders(
        state$.value,
      );

      return concat(
        of(ChatActions.clearAsrInsertionContext()),
        sendMessage(selectedConversations, {
          role: Role.User,
          content: combinedContent,
          custom_content: getUserCustomContent(selectedFiles, selectedFolders),
        }),
      );
    }),
  );

const transcriptionFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.transcriptionFailed.type),
    map(({ payload }) =>
      UIActions.showErrorToast({
        message: translate(
          payload?.isTooLarge
            ? ChatI18nKeys.TranscriptionFailedTooLarge
            : ChatI18nKeys.TranscriptionFailed,
        ),
      }),
    ),
  );

const userMessageTranscriptionFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.userMessageTranscriptionFailed.type),
    map(({ payload }) =>
      UIActions.showErrorToast({
        message: translate(
          payload?.isTooLarge
            ? ChatI18nKeys.TranscriptionFailedTooLarge
            : ChatI18nKeys.TranscriptionFailed,
        ),
      }),
    ),
  );

export const ChatEpics = combineEpics(
  setFormValueEpic,
  getConfigurationSchemaEpic,
  startConfigurationSchemaUploadingEpic,
  getConfigurationSchemaFailedEpic,
  appendInputContentEpic,
  getEntityInfoEpic,
  getEntityInfoFailEpic,
  handleVoiceRecordingEpic,
  handleUserMessageVoiceRecordingEpic,
  startTranscriptionEpic,
  transcriptionSuccessEpic,
  transcriptionFailedEpic,
  userMessageTranscriptionFailedEpic,
);
