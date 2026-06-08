import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconFileDescription, IconMenu2 } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router-dom';
import { ROUTES } from '../../constants/routes.js';
import {
  ConversationHistoryI18nKeys,
  NavigationI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import SideBarLeft from '../../icons/side-bar-left.svg?react';
import SideBarRight from '../../icons/side-bar-right.svg?react';
import Logo from './Logo';

interface Props {
  onMenuToggle: () => void;
  isHistoryPanelOpen?: boolean;
  onHistoryPanelToggle?: () => void;
}

const Header: FC<Props> = ({
  onMenuToggle,
  isHistoryPanelOpen,
  onHistoryPanelToggle,
}) => {
  const { t } = useTranslation();
  const isConversationRoute = !!useMatch(`${ROUTES.CONVERSATIONS}/*`);
  const { isOpen: isSourcesSidebarOpen, handleOpen: handleOpenSourcesSidebar } =
    useSourcesSidebar();

  const Icon = !isHistoryPanelOpen ? SideBarLeft : SideBarRight;

  return (
    <header className="relative z-30 grid min-h-[49px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-secondary">
      <div className="flex items-center ps-2">
        <DialGhostIconButton
          icon={<IconMenu2 size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(NavigationI18nKeys.OpenMenu)}
          onClick={onMenuToggle}
          className="desktop:hidden"
        />
        {onHistoryPanelToggle && (
          <DialGhostIconButton
            icon={<Icon />}
            aria-label={t(ConversationHistoryI18nKeys.ToggleAriaLabel)}
            aria-pressed={isHistoryPanelOpen}
            tooltipProps={{
              tooltip: t(ConversationHistoryI18nKeys.ToggleAriaLabel),
            }}
            onClick={onHistoryPanelToggle}
            className="hidden desktop:flex"
          />
        )}
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
