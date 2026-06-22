import { useSidebarPanelToggles } from '@/src/hooks/useSidebarPanelToggles';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { HeaderI18nKeys } from '@/src/constants/i18n';

import { ToggleSidebarButton } from '@/src/components/Buttons/ToggleSidebarButton';

import { BaseHeader } from './BaseHeader';
import { CreateNewConversation } from './CreateNewEntity';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

export const Header = Inversify.register('Header', () => {
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

  return (
    <BaseHeader
      LeftItems={
        <>
          {enabledFeatures.has(Feature.ConversationsSection) && (
            <ToggleSidebarButton
              iconSize={headerIconSize}
              tooltip={HeaderI18nKeys.Conversations}
              isOpened={showChatbar}
              onToggle={handleToggleChatbar}
              dataQa="left-panel-toggle"
              isOverlay={isOverlay}
            />
          )}
          <div className="w-12 md:w-16">
            {!enabledFeatures.has(Feature.HideNewConversation) &&
              !showChatbar && (
                <CreateNewConversation iconSize={headerIconSize} />
              )}
          </div>
        </>
      }
      RightItems={
        enabledFeatures.has(Feature.PromptsSection) && (
          <ToggleSidebarButton
            iconSize={headerIconSize}
            tooltip={HeaderI18nKeys.Prompts}
            isOpened={showPromptbar}
            onToggle={handleTogglePromtbar}
            dataQa="right-panel-toggle"
            rightSide
            isOverlay={isOverlay}
          />
        )
      }
    />
  );
});
