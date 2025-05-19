import { EMPTY, catchError, concat, map, of, switchMap, takeUntil } from 'rxjs';

import { combineEpics, ofType } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { getUserCustomContent } from '@/src/utils/app/file';
import {
  isConversationId,
  isEntityIdExternal,
  isPromptId,
} from '@/src/utils/app/id';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';

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
} from '@/src/store/selectors';

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
      const configurationSchema = ChatSelectors.selectConfigurationSchema(
        state$.value,
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

      return concat(
        of(ConversationsActions.setIsMessageSending(true)),
        of(FilesActions.resetSelectedFiles()),
        of(ChatActions.resetFormValue()),
        of(ChatActions.setInputContent('')),
        of(
          ConversationsActions.sendMessages({
            conversations: selectedConversations,
            message,
            deleteCount: 0,
            activeReplayIndex: 0,
          }),
        ),
      );
    }),
  );

const getConfigurationSchemaEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ChatActions.getConfigurationSchema.type),
    switchMap(({ payload }) => {
      const selectedConversations =
        ConversationsSelectors.selectSelectedConversations(state$.value);
      const savedConfigurationSchema =
        selectedConversations[0]?.messages?.[0]?.custom_content
          ?.configuration_schema;

      if (savedConfigurationSchema) {
        return of(
          ChatActions.getConfigurationSchemaSuccess(savedConfigurationSchema),
        );
      }

      return ApplicationService.getConfigurationSchema(payload.modelId).pipe(
        switchMap((schema) => {
          return of(ChatActions.getConfigurationSchemaSuccess(schema));
        }),
        catchError(() => {
          return of(ChatActions.getConfigurationSchemaFailed());
        }),
        takeUntil(
          action$.pipe(ofType(ConversationsActions.selectConversations.type)),
        ),
      );
    }),
  );

const getConfigurationSchemaFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    ofType(ChatActions.getConfigurationSchemaFailed.type),
    map(() => {
      return UIActions.showErrorToast(
        translate('Failed to load chat starters'),
      );
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
          errorText: 'Could not get entity info. Unknown entity.',
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
        of(UIActions.showErrorToast(translate(payload.errorText))),
      );
    }),
  );

export const ChatEpics = combineEpics(
  setFormValueEpic,
  getConfigurationSchemaEpic,
  getConfigurationSchemaFailedEpic,
  appendInputContentEpic,
  getEntityInfoEpic,
  getEntityInfoFailEpic,
);
