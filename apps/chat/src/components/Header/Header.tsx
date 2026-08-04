import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, GhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconLayoutSidebarRight,
  IconMenu2,
  IconPlus,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router-dom';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
  NavigationI18nKeys,
} from '../../constants/translation-keys';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import styles from './Header.module.scss';
import Logo from './Logo';
import SourcesSidebarToggle from './SourcesSidebarToggle';

interface Props {
  onMenuToggle: () => void;
  isConversationPanelOpen?: boolean;
  onConversationPanelToggle?: () => void;
  onNewChat?: () => void;
}

const Header: FC<Props> = ({
  onMenuToggle,
  isConversationPanelOpen,
  onConversationPanelToggle,
  onNewChat,
}) => {
  const { t } = useTranslation();
  const isConversationRoute = !!useMatch(`${ROUTES.Conversations}/*`);
  const isRootRoute = !!useMatch(ROUTES.Root);
  const isConversationPanel = isConversationRoute || isRootRoute;
  const isHeaderEnabled = useUiFeature(OverlayFeature.Header);
  const isConversationsPanelToggleEnabled = useUiFeature(
    OverlayFeature.ConversationsPanelToggle,
  );
  const isNewConversationHidden = useUiFeature(
    OverlayFeature.HideNewConversation,
  );

  if (!isHeaderEnabled) {
    return null;
  }

  return (
    <header
      className={mergeClasses(
        'z-30 grid min-h-[64px] w-full grid-cols-[1fr_auto_1fr] items-center bg-transparent desktop:hidden',
        isRootRoute ? 'absolute inset-x-0 top-0' : 'relative',
      )}
    >
      <div className="flex items-center gap-1 ps-3">
        {onConversationPanelToggle != null &&
          isConversationPanel &&
          isConversationsPanelToggleEnabled && (
            <GhostIconButton
              icon={
                <IconLayoutSidebarRight
                  size={DIAL_ICON_SIZE.LG}
                  stroke={1.5}
                  className={
                    !isConversationPanelOpen ? 'scale-x-[-1]' : undefined
                  }
                />
              }
              aria-label={t(ConversationPanelI18nKeys.ToggleAriaLabel)}
              aria-pressed={isConversationPanelOpen}
              tooltipProps={{
                tooltip: t(ConversationPanelI18nKeys.ToggleAriaLabel),
              }}
              onClick={onConversationPanelToggle}
            />
          )}
        {onNewChat != null &&
          isConversationPanel &&
          !isNewConversationHidden && (
            <div
              className={mergeClasses(
                'overflow-hidden transition-all duration-200 ease-in-out',
                isConversationPanelOpen
                  ? 'max-w-0 opacity-0'
                  : 'max-w-[40px] opacity-100',
              )}
            >
              <GhostIconButton
                icon={
                  <IconPlus
                    size={DIAL_ICON_SIZE.LG}
                    stroke={1.5}
                    className={
                      !isConversationPanelOpen
                        ? styles.newChatIconPop
                        : undefined
                    }
                  />
                }
                onClick={onNewChat}
                aria-label={t(ButtonsI18nKeys.NewChat)}
                tabIndex={isConversationPanelOpen ? -1 : 0}
              />
            </div>
          )}
        <GhostIconButton
          icon={<IconMenu2 size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(NavigationI18nKeys.OpenMenu)}
          onClick={onMenuToggle}
        />
      </div>
      <Logo />
      <div className="flex justify-end pe-3">
        <SourcesSidebarToggle />
      </div>
    </header>
  );
};

export default memo(Header);
