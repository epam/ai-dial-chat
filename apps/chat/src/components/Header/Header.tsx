import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import {
  IconFileDescription,
  IconLayoutSidebarRight,
  IconMenu2,
} from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router-dom';
import {
  ConversationPanelI18nKeys,
  NavigationI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { ROUTES } from '../../types/routes';
import Logo from './Logo';

interface Props {
  onMenuToggle: () => void;
  isConversationPanelOpen?: boolean;
  onConversationPanelToggle?: () => void;
}

const Header: FC<Props> = ({
  onMenuToggle,
  isConversationPanelOpen,
  onConversationPanelToggle,
}) => {
  const { t } = useTranslation();
  const isConversationRoute = !!useMatch(`${ROUTES.Conversations}/*`);
  const isRootRoute = !!useMatch(ROUTES.Root);
  const isConversationPanel = isConversationRoute || isRootRoute;
  const { isOpen: isSourcesSidebarOpen, handleOpen: handleOpenSourcesSidebar } =
    useSourcesSidebar();

  return (
    <header className="relative z-30 grid min-h-[49px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-secondary">
      <div className="flex items-center gap-x-2 ps-3">
        {onConversationPanelToggle && isConversationPanel && (
          <DialGhostIconButton
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
        <DialGhostIconButton
          icon={<IconMenu2 size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(NavigationI18nKeys.OpenMenu)}
          onClick={onMenuToggle}
          className="desktop:hidden"
        />
      </div>
      <Logo />
      <div className="flex justify-end pe-2">
        {isConversationRoute && !isSourcesSidebarOpen && (
          <DialGhostIconButton
            icon={<IconFileDescription size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(SidebarI18nKeys.ToggleOpen)}
            aria-pressed={isSourcesSidebarOpen}
            tooltipProps={{ tooltip: t(SidebarI18nKeys.ToggleOpen) }}
            onClick={handleOpenSourcesSidebar}
          />
        )}
      </div>
    </header>
  );
};

export default memo(Header);
