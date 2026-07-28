import { mergeClasses, OverlayFeature } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconLayoutSidebarRight, IconPlus } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useMatch } from 'react-router-dom';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import SourcesSidebarToggle from '../Header/SourcesSidebarToggle';
import styles from './ChatLayout.module.scss';

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
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={mergeClasses(
          'hidden items-center gap-2 px-2 desktop:flex',
          isRootRoute ? 'absolute inset-x-0 top-0 z-10 h-16' : 'h-16 shrink-0',
          'border-b border-primary',
        )}
      >
        {isConversationsPanelToggleEnabled && (
          <DialGhostIconButton
            icon={
              <IconLayoutSidebarRight
                size={DIAL_ICON_SIZE.LG}
                stroke={1.5}
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
          <DialGhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(ButtonsI18nKeys.NewChat)}
            tooltipProps={{ tooltip: t(ButtonsI18nKeys.NewChat) }}
            onClick={onNewChat}
            className={styles.newChatButton}
          />
        )}
        <div className="ms-auto">
          <SourcesSidebarToggle />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default memo(ChatLayout);
