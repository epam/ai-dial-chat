import { concat, of } from 'rxjs';

import { Conversation } from '@/src/types/chat';

import {
  ChatActions,
  ConversationsActions,
  FilesActions,
} from '@/src/store/actions';

import { Message } from '@epam/ai-dial-shared';

export const sendMessage = (
  conversations: Conversation[],
  message: Message,
  ...extraActions: ReturnType<typeof ChatActions.resetFormValue>[]
) =>
  concat(
    of(ConversationsActions.setIsMessageSending(true)),
    of(FilesActions.resetSelectedFiles()),
    ...extraActions.map((a) => of(a)),
    of(ChatActions.setInputContent('')),
    of(
      ConversationsActions.sendMessages({
        conversations,
        message,
        deleteCount: 0,
        activeReplayIndex: 0,
      }),
    ),
  );

export const readBlobAsBase64 = (blob: Blob): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
