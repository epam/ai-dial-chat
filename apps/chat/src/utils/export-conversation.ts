import type {
  Conversation,
  ExportFolderV5,
  ExportFormatV5,
} from '@epam/ai-dial-chat-shared';
import { ExportFileNameKind } from '../types/conversation-export';

export const buildExportEnvelope = (
  conversations: Conversation[],
  folders: ExportFolderV5[] = [],
): ExportFormatV5 => ({
  version: 5,
  history: conversations,
  folders,
});

export const serializeExportEnvelope = (envelope: ExportFormatV5): Blob =>
  new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });

const formatExportDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EXPORT_FILE_EXTENSION: Record<ExportFileNameKind, string> = {
  [ExportFileNameKind.SingleConversation]: 'json',
  [ExportFileNameKind.SingleConversationWithAttachments]: 'dial',
  [ExportFileNameKind.AllConversationsHistory]: 'json',
};

export const buildExportFileName = (
  kind: ExportFileNameKind,
  appName: string,
  date: Date = new Date(),
): string =>
  `${formatExportDate(date)}_${appName}_${kind}.${EXPORT_FILE_EXTENSION[kind]}`;
