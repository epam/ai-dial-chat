import { useSidebarPanelToggles } from '@/src/hooks/useSidebarPanelToggles';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { HeaderI18nKeys } from '@/src/constants/i18n';

import { ToggleSidebarButton } from '@/src/components/Buttons/ToggleSidebarButton';

import { Feature } from '@epam/ai-dial-shared';

export const FloatingPanelToggles = () => {
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const {
    showChatbar,
    showPromptbar,
    isOverlay,
    headerIconSize,
    handleToggleChatbar,
    handleTogglePromtbar,
  } = useSidebarPanelToggles();

  const showConversationsToggle = enabledFeatures.has(
    Feature.ConversationsPanelToggle,
  );
  const showPromptsToggle = enabledFeatures.has(Feature.PromptsPanelToggle);

  if (
    enabledFeatures.has(Feature.Header) ||
    (!showConversationsToggle && !showPromptsToggle)
  ) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between p-2"
      data-qa="floating-panel-toggles"
    >
      {showConversationsToggle && (
        <div className="pointer-events-auto">
          <ToggleSidebarButton
            iconSize={headerIconSize}
            tooltip={HeaderI18nKeys.Conversations}
            isOpened={showChatbar}
            onToggle={handleToggleChatbar}
            dataQa="left-panel-toggle"
            isOverlay={isOverlay}
            isFloatingToggle
          />
        </div>
      )}
      {showPromptsToggle && (
        <div className="pointer-events-auto">
          <ToggleSidebarButton
            iconSize={headerIconSize}
            tooltip={HeaderI18nKeys.Prompts}
            isOpened={showPromptbar}
            onToggle={handleTogglePromtbar}
            dataQa="right-panel-toggle"
            rightSide
            isOverlay={isOverlay}
            isFloatingToggle
          />
        </div>
      )}
    </div>
  );
};
