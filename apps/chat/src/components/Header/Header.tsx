import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconFileDescription, IconMenu2 } from '@tabler/icons-react';
import { memo } from 'react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NavigationI18nKeys,
  SidebarI18nKeys,
} from '../../constants/translation-keys.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import Logo from './Logo';

interface Props {
  onMenuToggle: () => void;
}

const Header: FC<Props> = ({ onMenuToggle }) => {
  const { t } = useTranslation();
  const { isOpen: isSourcesSidebarOpen, handleOpen: handleOpenSourcesSidebar } =
    useSourcesSidebar();

  return (
    <header className="relative z-30 grid min-h-[49px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-secondary">
      <div className="flex items-center pl-2">
        <DialGhostIconButton
          icon={<IconMenu2 size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(NavigationI18nKeys.OpenMenu)}
          onClick={onMenuToggle}
          className="desktop:hidden"
        />
      </div>
      <Logo />
      <div className="flex justify-end pr-2">
        {!isSourcesSidebarOpen && (
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
