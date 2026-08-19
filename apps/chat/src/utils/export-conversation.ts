import type {
  Conversation,
  ExportFolder,
  ExportFormat,
} from '@epam/ai-dial-chat-shared';
import { ExportFileNameKind } from '../types/conversation-export';
import { formatDateYMD } from './date';

/** Placeholder app name used in every export file name — this branch has no app display-name config yet. */
export const EXPORT_APP_NAME = 'ai_dial';

export const buildExportEnvelope = (
  conversations: Conversation[],
  folders: ExportFolder[] = [],
): ExportFormat => ({
  version: 5,
  history: conversations,
  folders,
});

export const serializeExportEnvelope = (envelope: ExportFormat): Blob =>
  new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });

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
  `${formatDateYMD(date)}_${appName}_${kind}.${EXPORT_FILE_EXTENSION[kind]}`;
