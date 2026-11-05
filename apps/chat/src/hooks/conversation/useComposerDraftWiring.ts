import {
  type ConversationDraft,
  useConversationComposerDraft,
} from '@epam/ai-dial-chat-hooks/conversation';
import {
  useComposerSeed,
  useComposerSeedSource,
} from '@epam/ai-dial-conversation-input';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { useSkillSelectorOverlay } from '../../components/SkillSelector/useSkillSelectorOverlay';
import { useConversationDraftStore } from '../../hooks/conversation/useConversationDraftStore';
import type { useConversationDeploymentState } from './useConversationDeploymentState';

type SkillOverlay = ReturnType<typeof useSkillSelectorOverlay>;

interface UseComposerDraftWiringParams {
  conversationId: string;
  /* Overlay-mode external content and its revision. */
  inputContent: string | undefined;
  inputContentRevision: number | undefined;
  selectedDeployment: ReturnType<
    typeof useConversationDeploymentState
  >['selectedDeployment'];
  isLoading: boolean;
  onDraftChange: SkillOverlay['onDraftChange'];
  seedComposerSkillMentions: SkillOverlay['seedSkillMentions'];
  selectedSkills: SkillOverlay['selectedSkills'];
  skillMessage: SkillOverlay['message'];
  skillMessageRevision: SkillOverlay['messageRevision'];
}

/**
 * Seeds the conversation composer and persists its per-conversation draft:
 * merges overlay content and skill-mention pushes into one seed, restores a
 * stored draft (skills through the composer's mention instance), skips the
 * restore for the conversation open at mount when overlay content was
 * already present, and keeps the draft in step with text and skill changes.
 * Order matters and is preserved as one block: the skip-restore state and
 * its render-phase reset precede `useConversationComposerDraft`, and the
 * skill-message seed source runs after the overlay-content one.
 */
export const useComposerDraftWiring = ({
  conversationId,
  inputContent,
  inputContentRevision,
  selectedDeployment,
  isLoading,
  onDraftChange,
  seedComposerSkillMentions,
  selectedSkills,
  skillMessage,
  skillMessageRevision,
}: UseComposerDraftWiringParams) => {
  /*
   * Merges two independent "seed the composer once" sources into the one
   * message/messageRevision pair ConversationInput accepts: this component's
   * own `inputContent`/`inputContentRevision` props (overlay mode's external
   * content injection) and the skill hook's own message/messageRevision push
   * (a mention insertion).
   */
  const {
    message: composerSeedText,
    messageRevision: composerSeedRevision,
    seedMessage: seedComposerSeed,
  } = useComposerSeed({
    text: inputContent,
    revision: inputContentRevision ?? 0,
  });

  /*
   * Per-conversation composer draft. The lib owns the save/restore/clear state
   * machine; this view only decides how a draft is seeded back: skill drafts
   * through the composer's mention instance (so chips come back active),
   * everything else as plain text. A skill draft waits for the deployments to
   * load so its skills support is known — a deployment that is gone once they
   * have loaded gets the text only — and overlay content present at mount wins
   * over whatever was stored.
   */
  const draftStore = useConversationDraftStore();
  const isSkillsSupported =
    selectedDeployment?.features?.skillsSupported === true;
  const hasStoredDraftSkills = useMemo(
    () => (draftStore?.read(conversationId)?.skills.length ?? 0) > 0,
    [draftStore, conversationId],
  );
  const [hasInputContentAtMount] = useState(
    () => (inputContentRevision ?? 0) > 0,
  );
  /*
   * The mount-time overlay content belongs to the conversation open at mount
   * only. Dropped during render rather than in an effect, so the id change
   * costs no extra commit.
   */
  const [skipRestoreConversationId, setSkipRestoreConversationId] = useState(
    () => (hasInputContentAtMount ? conversationId : undefined),
  );
  if (
    skipRestoreConversationId != null &&
    conversationId !== skipRestoreConversationId
  ) {
    setSkipRestoreConversationId(undefined);
  }
  const restoreDraft = useCallback(
    ({ text, skills }: ConversationDraft) => {
      if (skills.length > 0 && isSkillsSupported) {
        seedComposerSkillMentions(text, skills);
        return;
      }
      seedComposerSeed(text);
    },
    [isSkillsSupported, seedComposerSkillMentions, seedComposerSeed],
  );
  const {
    handleTextChange: handleDraftTextChange,
    handleSkillsChange: handleDraftSkillsChange,
    handleExternalContent: handleDraftExternalContent,
    sendWithDraft,
  } = useConversationComposerDraft({
    store: draftStore,
    conversationId: conversationId,
    restoreDraft,
    isRestoreReady: !(
      hasStoredDraftSkills &&
      selectedDeployment == null &&
      isLoading
    ),
    shouldSkipRestore: skipRestoreConversationId === conversationId,
  });
  const handleDraftChange = useCallback(
    (text: string) => {
      onDraftChange(text);
      handleDraftTextChange(text);
    },
    [onDraftChange, handleDraftTextChange],
  );
  /*
   * Fires on a selection change only, not when the handler's identity moves
   * with the conversation id — the outgoing selection belongs to the previous
   * conversation and must not land in the next one's draft.
   */
  const lastDraftSkillsRef = useRef(selectedSkills);
  useEffect(() => {
    if (lastDraftSkillsRef.current === selectedSkills) return;
    lastDraftSkillsRef.current = selectedSkills;
    handleDraftSkillsChange(selectedSkills ?? []);
  }, [selectedSkills, handleDraftSkillsChange]);
  /* Overlay content already present at mount is the initial seed; persist it as the draft. */
  useEffect(() => {
    if (hasInputContentAtMount) handleDraftExternalContent(inputContent ?? '');
    // Mount-only: later overlay content arrives through the seed source below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useComposerSeedSource(inputContentRevision, () => {
    /* A drop back to 0 is the host marking the content spent, not new content. */
    if (!inputContentRevision) return;
    seedComposerSeed(inputContent ?? '');
    handleDraftExternalContent(inputContent ?? '');
  });
  useComposerSeedSource(skillMessageRevision, () =>
    seedComposerSeed(skillMessage),
  );

  return {
    composerSeedText,
    composerSeedRevision,
    handleDraftChange,
    sendWithDraft,
  };
};
