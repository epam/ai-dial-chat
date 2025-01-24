import { EMPTY, catchError, concat, filter, map, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { ApplicationService } from '@/src/utils/app/data/application-service';
import { getUserCustomContent } from '@/src/utils/app/file';
import { translate } from '@/src/utils/app/translation';

import { AppEpic } from '@/src/types/store';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { Message, Role } from '@epam/ai-dial-shared';

const setFormValueEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    filter(ChatActions.setFormValue.match),
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
    filter(ChatActions.getConfigurationSchema.match),
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
      );
    }),
  );

const getConfigurationSchemaFailedEpic: AppEpic = (action$) =>
  action$.pipe(
    filter(ChatActions.getConfigurationSchemaFailed.match),
    map(() => {
      return UIActions.showErrorToast(
        translate('Failed to load chat starters'),
      );
    }),
  );

export const ChatEpics = combineEpics(
  setFormValueEpic,
  getConfigurationSchemaEpic,
  getConfigurationSchemaFailedEpic,
);
