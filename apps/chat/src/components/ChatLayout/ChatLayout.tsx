import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutSidebarRight, IconPlus } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatch } from 'react-router';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import Logo from '../Header/Logo';
import SourcesSidebarToggle from '../Header/SourcesSidebarToggle';

interface Props {
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  onNewChat: () => void;
}

const ChatLayout: FC<Props> = ({ isPanelOpen, onTogglePanel, onNewChat }) => {
  const { t } = useTranslation();
  const isRootRoute = !!useMatch(ROUTES.Root);
  const isConversationsPanelToggleEnabled = useUiFeature(
    OverlayFeature.ConversationsPanelToggle,
  );
  const isNewConversationHidden = useUiFeature(
    OverlayFeature.HideNewConversation,
  );
  const isHeaderLogoShown = useUiFeature(OverlayFeature.ShowHeaderLogo);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={mergeClasses(
          'hidden grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 desktop:grid',
          isRootRoute ? 'absolute inset-x-0 top-0 z-10 h-16' : 'h-16 shrink-0',
        )}
      >
        <div className="flex items-center gap-2">
          {isConversationsPanelToggleEnabled && (
            <GhostIconButton
              icon={
                <IconLayoutSidebarRight
                  size={DIAL_ICON_SIZE.LG}
                  stroke={DIAL_KIT_ICON_STROKE}
                  className="rtl:scale-x-[-1]"
                />
              }
              aria-label={t(ConversationPanelI18nKeys.ToggleAriaLabel)}
              tooltipProps={{
                tooltip: t(ConversationPanelI18nKeys.ToggleAriaLabel),
              }}
              onClick={onTogglePanel}
            />
          )}
          {!isPanelOpen && !isNewConversationHidden && (
            <GhostIconButton
              icon={
                <IconPlus
                  size={DIAL_ICON_SIZE.LG}
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              }
              aria-label={t(ButtonsI18nKeys.NewChat)}
              tooltipProps={{ tooltip: t(ButtonsI18nKeys.NewChat) }}
              onClick={onNewChat}
            />
          )}
        </div>
        {/* An empty center cell keeps the grid's side columns in place. */}
        <div>{isHeaderLogoShown && <Logo />}</div>
        <div className="flex justify-end">
          <SourcesSidebarToggle />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default memo(ChatLayout);
