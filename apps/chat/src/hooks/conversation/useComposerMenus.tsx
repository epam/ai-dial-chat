import {
  useComposerSeed,
  useComposerSeedSource,
} from '@epam/ai-dial-conversation-input';
import { BASE_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconPrompt } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePromptSelectorOverlay } from '../../components/PromptSelector/usePromptSelectorOverlay';
import { useSkillSelectorOverlay } from '../../components/SkillSelector/useSkillSelectorOverlay';
import { PromptSelectorI18nKeys } from '../../constants/translation-keys';

interface Options {
  /** Whether the selected deployment accepts skills. */
  isSkillsSupported: boolean;
}

/**
 * The new-conversation composer's prompt and skill features, shared by every
 * screen that starts a chat: the `+` menu's Prompts and Skills entries, the
 * `/` command menu, skill mentions, the composer seed and caret insertion,
 * and the modals they open (render `modals` once beside the composer).
 */
export const useComposerMenus = ({ isSkillsSupported }: Options) => {
  const { t } = useTranslation();
  /*
   * One owner for every text pushed into the composer — route state, a
   * non-submitting starter selection, and the skill hook's own
   * message/messageRevision push (a mention insertion) — merged into the one
   * message/messageRevision pair `NewConversationComposer` accepts.
   */
  const {
    message,
    messageRevision,
    seedMessage: seedComposerText,
  } = useComposerSeed();
  /*
   * A picked prompt is inserted at the caret rather than seeded, so it cannot
   * discard a draft the user has already typed ([#8754](https://github.com/epam/ai-dial-chat/issues/8754)).
   */
  const [inputInsertion, setInputInsertion] = useState({
    revision: 0,
    text: '',
  });
  const handleInsertText = useCallback((text: string) => {
    setInputInsertion((prev) => ({ revision: prev.revision + 1, text }));
  }, []);

  const {
    skillMenuOverlay,
    commandMenu,
    skillCatalogModal,
    skillDetailsPanel,
    message: skillMessage,
    messageRevision: skillMessageRevision,
    activeMentions,
    onDraftChange,
    onBackspaceAtCaret,
    caretPositionOverride,
    selectedSkills,
    isSkillUnsupported,
    selectSkillByUrl,
    resetSkillMentions,
    seedSkillMentions,
    recognizeMentionsInInsertion,
  } = useSkillSelectorOverlay({ isSkillsSupported });

  /* A `/skill-name` written in a prompt's text becomes a real mention once inserted ([#9354](https://github.com/epam/ai-dial-chat/issues/9354)). */
  const handlePromptInsertText = useCallback(
    (text: string) => {
      recognizeMentionsInInsertion(text);
      handleInsertText(text);
    },
    [recognizeMentionsInInsertion, handleInsertText],
  );
  const {
    renderOverlay: renderPromptsOverlay,
    promptCatalogModal,
    parametersPopup,
    openParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: handlePromptInsertText });

  useComposerSeedSource(skillMessageRevision, () =>
    seedComposerText(skillMessage),
  );

  /*
   * The Skills entry joins the Prompts entry in array order, so it renders
   * below Prompts in the `+` menu; `undefined` when both are flag-disabled
   * keeps the `+` button's empty-menu rule intact.
   */
  const menuOverlays = useMemo(() => {
    const entries = [
      ...(renderPromptsOverlay
        ? [
            {
              key: 'prompts',
              title: t(PromptSelectorI18nKeys.AddMenuLabel),
              icon: (
                <IconPrompt
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              renderOverlay: renderPromptsOverlay,
            },
          ]
        : []),
      ...(skillMenuOverlay ? [skillMenuOverlay] : []),
    ];
    return entries.length > 0 ? entries : undefined;
  }, [renderPromptsOverlay, skillMenuOverlay, t]);

  const modals = (
    <>
      {promptCatalogModal}
      {parametersPopup}
      {skillCatalogModal}
      {skillDetailsPanel}
    </>
  );

  return {
    /** Props to spread on `NewConversationComposer`. */
    composerProps: {
      message,
      messageRevision,
      onChange: onDraftChange,
      inputInsertion,
      menuOverlays,
      activeMentions,
      onBackspaceAtCaret,
      caretPositionOverride,
      isSkillUnsupported,
      commandMenu,
    },
    modals,
    selectedSkills,
    resetSkillMentions,
    seedSkillMentions,
    selectSkillByUrl,
    seedComposerText,
    openParametersPopup,
  };
};
