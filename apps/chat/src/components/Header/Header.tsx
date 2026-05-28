import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconFileDescription } from '@tabler/icons-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { SidebarI18nKeys } from '../../constants/translation-keys.js';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext.js';
import Logo from './Logo';

const Header = () => {
  const { t } = useTranslation();
  const { isOpen: isSourcesSidebarOpen, open: openSourcesSidebar } = useSourcesSidebar();

  return (
    <header className="relative z-30 grid min-h-[49px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-secondary">
      <div />
      <Logo />
      <div className="flex justify-end pr-2">
        {!isSourcesSidebarOpen && (
          <DialGhostIconButton
            icon={<IconFileDescription size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(SidebarI18nKeys.ToggleOpen)}
            aria-pressed={isSourcesSidebarOpen}
            tooltipProps={{ tooltip: t(SidebarI18nKeys.ToggleOpen) }}
            onClick={openSourcesSidebar}
          />
        )}
      </div>
    </header>
  );
};

export default memo(Header);
