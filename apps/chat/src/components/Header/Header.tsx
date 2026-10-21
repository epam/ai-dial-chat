import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import {
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconPlus,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router';
import { MOBILE_SIDEBAR_ID } from '../../constants/layout';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
  NavigationI18nKeys,
} from '../../constants/translation-keys';
import { useMobileSidebarContent } from '../../hooks/navigation/useMobileSidebarContent';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import Logo from './Logo';
import SourcesSidebarToggle from './SourcesSidebarToggle';

interface Props {
  /** Opens or closes the sidebar drawer. */
  onMenuToggle: () => void;
  /** Whether the sidebar drawer is open; drives the toggle's `aria-expanded`. */
  isMenuOpen?: boolean;
  onNewChat?: () => void;
}

/**
 * The mobile header: the sidebar toggle and New chat on the start side, the
 * logo in the middle and the sources toggle on the end side, over a 1px divider.
 */
const Header: FC<Props> = ({ onMenuToggle, isMenuOpen = false, onNewChat }) => {
  const { t } = useTranslation();
  const isRootRoute = !!useMatch(ROUTES.Root);
  const isHeaderEnabled = useUiFeature(OverlayFeature.Header);
  const isHeaderLogoShown = useUiFeature(OverlayFeature.ShowHeaderLogo);
  const isNewConversationHidden = useUiFeature(
    OverlayFeature.HideNewConversation,
  );
  const { hasNavigation, isReachable: isSidebarReachable } =
    useMobileSidebarContent();

  /* `show-header-logo` keeps the brand visible on mobile even when the host
     turns the header off: the row then carries only the logo. */
  if (!isHeaderEnabled && !isHeaderLogoShown) {
    return null;
  }

  return (
    <header
      className={mergeClasses(
        'z-30 grid min-h-[48px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-b-tertiary bg-transparent desktop:hidden',
        isRootRoute ? 'absolute inset-x-0 top-0' : 'relative',
      )}
    >
      <div className="flex items-center gap-1 ps-3">
        {isHeaderEnabled && isSidebarReachable && (
          <GhostIconButton
            icon={
              <IconLayoutSidebar
                size={DIAL_ICON_SIZE.LG}
                stroke={DIAL_KIT_ICON_STROKE}
                className="rtl:scale-x-[-1]"
                aria-hidden
              />
            }
            aria-label={t(
              hasNavigation
                ? NavigationI18nKeys.Menu
                : ConversationPanelI18nKeys.ChatsAndTasks,
            )}
            aria-expanded={isMenuOpen}
            aria-controls={MOBILE_SIDEBAR_ID}
            onClick={onMenuToggle}
          />
        )}
        {isHeaderEnabled && onNewChat != null && !isNewConversationHidden && (
          <GhostIconButton
            icon={
              <IconPlus
                size={DIAL_ICON_SIZE.LG}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            onClick={onNewChat}
            aria-label={t(ButtonsI18nKeys.NewChat)}
          />
        )}
      </div>
      <Logo />
      <div className="flex justify-end pe-3">
        {isHeaderEnabled && (
          <SourcesSidebarToggle
            icon={IconLayoutSidebarRight}
            iconClassName="rtl:scale-x-[-1]"
          />
        )}
      </div>
    </header>
  );
};

export default memo(Header);
