import {
  type Attachment,
  type DisplayAttachment,
  type Message,
  MessageRole,
  type RequestSkill,
} from '@epam/ai-dial-chat-shared';

/** Whether at least one tool toggle in `value` is active. */
export const hasActiveToolConfig = (
  value: Record<string, boolean> | undefined,
): boolean => value != null && Object.keys(value).length > 0;

/** Whether two `custom_content.skills` lists differ (compared by url, in order). */
const isSkillsChanged = (
  original: RequestSkill[] | undefined,
  next: RequestSkill[] | undefined,
): boolean => {
  if ((original?.length ?? 0) !== (next?.length ?? 0)) return true;
  return (original ?? []).some((skill, i) => skill.url !== next?.[i]?.url);
};

/**
 * Returns `true` when the edited text, attachment list, or skills list differs
 * from the original message, meaning a regeneration is needed.
 *
 * `skills` is the skills state the edit will write: `undefined` leaves the
 * original skills out of the comparison (nothing about them changes), while an
 * array — including an empty one — is compared against the original.
 *
 * @param originalMessage - The unmodified message stored in the conversation.
 * @param newText - The text the user submitted from the edit area.
 * @param keptDisplayAttachments - Attachments the user kept (not removed).
 * @param newAttachments - Brand-new attachments the user added during editing.
 * @param skills - The skills the edited message will carry, or `undefined` to leave them unchanged.
 */
export const isMessageChanged = (
  originalMessage: Message,
  newText: string,
  keptDisplayAttachments: DisplayAttachment[],
  newAttachments: Attachment[],
  skills?: RequestSkill[],
): boolean => {
  if (newText !== originalMessage.content) return true;
  if (newAttachments.length > 0) return true;
  const originalAttachmentCount =
    originalMessage.custom_content?.attachments?.length ?? 0;
  if (keptDisplayAttachments.length !== originalAttachmentCount) return true;
  return (
    skills != null &&
    isSkillsChanged(originalMessage.custom_content?.skills, skills)
  );
};

/**
 * Whether the assistant answer that follows an edited user message is missing
 * or incomplete: no message at all, a non-assistant message, an answer the
 * user stopped, or one that ended with a stream error.
 */
export const isAnswerIncomplete = (answer: Message | undefined): boolean =>
  answer == null ||
  answer.role !== MessageRole.Assistant ||
  !!answer.wasStoppedByUser ||
  answer.streamErrorMessage != null;

/**
 * Whether submitting an edit has to re-run the generation.
 *
 * True whenever the message itself changed, and also when it is unchanged but
 * its answer never completed — after stopping a generation the user submits
 * the same message precisely to get a full answer, so treating that as "no
 * change" would leave the conversation stuck with the partial one.
 *
 * @param skills - The skills the edited message will carry, or `undefined` to leave them unchanged — see {@link isMessageChanged}.
 */
export const shouldRerunGenerationOnEdit = (
  messages: Message[],
  messageIndex: number,
  newText: string,
  keptDisplayAttachments: DisplayAttachment[],
  newAttachments: Attachment[],
  skills?: RequestSkill[],
): boolean => {
  const originalMessage = messages[messageIndex];
  if (!originalMessage) return false;

  return (
    isMessageChanged(
      originalMessage,
      newText,
      keptDisplayAttachments,
      newAttachments,
      skills,
    ) || isAnswerIncomplete(messages[messageIndex + 1])
  );
};
