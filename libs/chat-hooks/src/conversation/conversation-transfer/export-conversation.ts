import type {
  Annotation,
  Conversation,
  ExportFolder,
  ExportFormat,
  Message,
  Stage,
} from '@epam/ai-dial-chat-shared';
import { formatDateYMD } from './date';
import { ExportFileNameKind } from './types';

/** Placeholder app name used in every export file name — this branch has no app display-name config yet. */
export const EXPORT_APP_NAME = 'ai_dial';

/** Drops the attachment list from every stage, keeping each stage's other fields. */
const stripStageAttachments = (stages: Stage[]): Stage[] =>
  stages.map(({ attachments: _attachments, ...stage }) => stage);

/** Drops the cited source document from every annotation, keeping its quote, title and target. */
const stripAnnotationSources = (annotations: Annotation[]): Annotation[] =>
  annotations.map((annotation) => {
    if (annotation.body?.source == null) return annotation;
    const { source: _source, ...body } = annotation.body;
    return { ...annotation, body };
  });

/**
 * Drops `custom_content.attachments`, every stage's attachments and every
 * citation's source document, omitting `custom_content` when nothing else
 * remains in it.
 */
const stripMessageAttachments = (message: Message): Message => {
  const customContent = message.custom_content;
  if (!customContent) return message;

  const { attachments, stages, annotations, ...keptContent } = customContent;
  if (attachments == null && stages == null && annotations == null) {
    return message;
  }

  const strippedContent = {
    ...keptContent,
    ...(stages ? { stages: stripStageAttachments(stages) } : {}),
    ...(annotations
      ? { annotations: stripAnnotationSources(annotations) }
      : {}),
  };
  if (Object.keys(strippedContent).length > 0) {
    return { ...message, custom_content: strippedContent };
  }

  const { custom_content: _customContent, ...messageWithoutContent } = message;
  return messageWithoutContent as Message;
};

/** Returns the conversation with every message-, stage- and citation-level attachment reference removed. */
export const stripConversationAttachments = (
  conversation: Conversation,
): Conversation => ({
  ...conversation,
  messages: conversation.messages.map(stripMessageAttachments),
});

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
