import { concat, of } from 'rxjs';

import { getQuickAttachmentsSavingPath } from '@/src/utils/app/conversation';
import { constructPath } from '@/src/utils/app/file';
import { getFileRootId } from '@/src/utils/app/id';

import { Conversation } from '@/src/types/chat';
import { HTTPMethod } from '@/src/types/http';

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

export interface VoiceQuickAttachment {
  file: File;
  fileId: string;
  relativePath: string;
  fileName: string;
}

export const createVoiceQuickAttachment = (
  audioBlob: Blob,
  fileExtension: string,
): VoiceQuickAttachment => {
  const timestamp = Date.now();
  const fileName = `voice-${timestamp}${fileExtension}`;
  const file = new File([audioBlob], fileName, { type: audioBlob.type });
  const folderPath = getQuickAttachmentsSavingPath();
  const relativePath = folderPath.split('/').slice(2).join('/');
  const fileId = constructPath(getFileRootId(), relativePath, fileName);

  return { file, fileId, relativePath, fileName };
};

export const requestAudioTranscription = async (
  audioData: string,
  mimeType: string,
): Promise<string | null> => {
  const response = await fetch('/api/transcribe', {
    method: HTTPMethod.POST,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioData, mimeType }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { transcript?: string };
  return data.transcript ?? null;
};
