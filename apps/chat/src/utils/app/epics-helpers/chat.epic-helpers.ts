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

import { TRANSCRIBE_SIZE_LIMIT_BYTES } from '@/src/constants/audio';

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

export interface TranscriptionResult {
  transcript: string | null;
  isTooLarge?: boolean;
}

export const requestAudioTranscription = async (
  audioData: string,
  mimeType: string,
): Promise<TranscriptionResult> => {
  const body = JSON.stringify({ audioData, mimeType });

  // Check actual UTF-8 byte size of the request body (what gets sent over HTTP)
  // In browser: new Blob([body]).size; In Node: Buffer.byteLength(body, 'utf8')
  const bodyByteLength =
    typeof Buffer !== 'undefined'
      ? Buffer.byteLength(body, 'utf8')
      : new Blob([body]).size;

  if (bodyByteLength > TRANSCRIBE_SIZE_LIMIT_BYTES) {
    return { transcript: null, isTooLarge: true };
  }

  const response = await fetch('/api/transcribe', {
    method: HTTPMethod.POST,
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (response.status === 413) {
    return { transcript: null, isTooLarge: true };
  }

  if (!response.ok) {
    return { transcript: null };
  }

  const data = (await response.json()) as { transcript?: string };
  return { transcript: data.transcript ?? null };
};
