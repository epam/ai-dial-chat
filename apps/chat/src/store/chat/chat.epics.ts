import { EMPTY, concat, filter, of, switchMap } from 'rxjs';

import { combineEpics } from 'redux-observable';

import { getUserCustomContent } from '@/src/utils/app/file';

import { AppEpic } from '@/src/types/store';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { ChatSelectors } from '@/src/store/chat/chat.selectors';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';

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
      const content = ChatSelectors.selectInputContent(state$.value);

      const message: Message = {
        role: Role.User,
        content,
        custom_content: {
          ...getUserCustomContent(selectedFiles, selectedFolders),
          form_value: formValue,
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

export const ChatEpics = combineEpics(setFormValueEpic);
