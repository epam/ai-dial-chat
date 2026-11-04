import { shouldRerunGenerationOnEdit } from '@epam/ai-dial-chat-hooks';
import { useConversationScroll } from '@epam/ai-dial-chat-hooks/scroll-anchoring';
import {
  type Attachment,
  DisplayAttachment,
  type RequestSkill,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ConversationViewProps } from '../../components/ConversationView/ConversationView';
import type { useSkillSelectorOverlay } from '../../components/SkillSelector/useSkillSelectorOverlay';
import type { useComposerDraftWiring } from './useComposerDraftWiring';

type SkillOverlay = ReturnType<typeof useSkillSelectorOverlay>;

interface UseAnchoredMessageActionsParams extends Pick<
  ConversationViewProps,
  | 'messages'
  | 'isAssistantTyping'
  | 'onSend'
  | 'onRegenerateMessage'
  | 'onStartEdit'
  | 'onCancelEdit'
  | 'onEditMessage'
> {
  /* From `useConversationScroll`: anchors the next reply below the sent message. */
  armAnchor: ReturnType<typeof useConversationScroll>['armAnchor'];
  sendWithDraft: ReturnType<typeof useComposerDraftWiring>['sendWithDraft'];
  /* Composer skill-mention instance. */
  selectedSkills: SkillOverlay['selectedSkills'];
  resetSkillMentions: SkillOverlay['resetSkillMentions'];
  /* Edit-surface skill-mention instance. */
  seedSkillMentions: SkillOverlay['seedSkillMentions'];
  resetEditSkillMentions: SkillOverlay['resetSkillMentions'];
  editSkills: RequestSkill[] | undefined;
}

/**
 * The conversation's send, regenerate and edit handlers, each arming the
 * scroll anchor so the reply is laid out below the message that produced it.
 * `messages`/`isAssistantTyping` are read through a ref assigned in a layout
 * effect, keeping the item handlers' identities stable while a reply streams
 * so `memo(ConversationMessageItem)` re-renders only the streaming message.
 */
export const useAnchoredMessageActions = ({
  messages,
  isAssistantTyping,
  onSend,
  onRegenerateMessage,
  onStartEdit,
  onCancelEdit,
  onEditMessage,
  armAnchor,
  sendWithDraft,
  selectedSkills,
  resetSkillMentions,
  seedSkillMentions,
  resetEditSkillMentions,
  editSkills,
}: UseAnchoredMessageActionsParams) => {
  const handleSendWithAnchor = useCallback(
    async (message: string, attachments: Attachment[]) => {
      armAnchor(messages.length);
      /* ConversationInput awaits this to know whether to restore the draft
       * on failure — forward onSend's rejection rather than discarding it.
       * `sendWithDraft` discards the stored draft only once onSend resolves. */
      await sendWithDraft(message, () =>
        onSend(message, attachments, selectedSkills),
      );
      /*
       * Clear only after a successful send: a rejected onSend restores the
       * draft, and the mentions should survive with it for the retry.
       * No-op while the skill flag is off.
       */
      resetSkillMentions();
    },
    [
      onSend,
      messages.length,
      armAnchor,
      selectedSkills,
      resetSkillMentions,
      sendWithDraft,
    ],
  );

  /*
   * Per-chunk values read by the message-item handlers at call time. Keeping
   * them out of those handlers' deps keeps every item's props stable while a
   * reply streams, so `memo(ConversationMessageItem)` re-renders only the
   * streaming message. Assigned in a layout effect: committed before any user
   * event can reach a handler.
   */
  const latestRef = useRef({ messages, isAssistantTyping });
  useLayoutEffect(() => {
    latestRef.current = { messages, isAssistantTyping };
  }, [messages, isAssistantTyping]);

  const handleRegenerateMessageWithAnchor = useCallback(
    (messageIndex: number) => {
      /*
       * Regenerating while another generation is in flight is a no-op in
       * handleRegenerateMessage — skip arming the anchor so a later,
       * unrelated message update doesn't consume a stale index.
       */
      if (!latestRef.current.isAssistantTyping) {
        armAnchor(messageIndex - 1);
      }
      onRegenerateMessage?.(messageIndex);
    },
    [onRegenerateMessage, armAnchor],
  );

  /*
   * Seeds the edit input with the edited message's full mention state:
   * `seedSkillMentions` reconstructs every mention's position in the
   * message's text, matching `custom_content.skills` in order. A no-op (empty
   * mentions) while the skill flag is off.
   */
  const handleStartEdit = useCallback(
    (messageIndex: number) => {
      const editedMessage = latestRef.current.messages[messageIndex];
      seedSkillMentions(
        editedMessage?.content ?? '',
        editedMessage?.custom_content?.skills,
      );
      onStartEdit?.(messageIndex);
    },
    [onStartEdit, seedSkillMentions],
  );

  /*
   * An edit session's mentions never outlive it — otherwise the composer
   * would silently attach the edited message's mentions to the next message.
   * No-op while the skill flag is off.
   */
  const handleCancelEdit = useCallback(
    (messageIndex: number) => {
      resetEditSkillMentions();
      onCancelEdit?.(messageIndex);
    },
    [onCancelEdit, resetEditSkillMentions],
  );

  const handleEditMessageWithAnchor = useCallback(
    (
      messageIndex: number,
      text: string,
      keptAttachments: DisplayAttachment[],
      newAttachments: Attachment[],
    ) => {
      /*
       * handleEditMessage no-ops if a generation is in flight, or if nothing
       * changed and the existing answer is complete (shouldRerunGenerationOnEdit
       * mirrors that same check) — skip arming in either case so a later,
       * unrelated update can't consume a stale index.
       */
      if (
        !latestRef.current.isAssistantTyping &&
        shouldRerunGenerationOnEdit(
          latestRef.current.messages,
          messageIndex,
          text,
          keptAttachments,
          newAttachments,
          editSkills,
        )
      ) {
        armAnchor(messageIndex);
      }
      onEditMessage?.(
        messageIndex,
        text,
        keptAttachments,
        newAttachments,
        editSkills,
      );
      /* The edit session consumed the mentions; the next edit starts fresh. */
      resetEditSkillMentions();
    },
    [onEditMessage, armAnchor, editSkills, resetEditSkillMentions],
  );

  return {
    handleSendWithAnchor,
    handleRegenerateMessageWithAnchor,
    handleStartEdit,
    handleCancelEdit,
    handleEditMessageWithAnchor,
  };
};
