import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import { NavigationI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useLogout } from '../../hooks/logout/useLogout';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import NavPageContent from '../MobileNavBottomSheet/NavPageContent';
import NavigableBottomSheet from '../NavigableBottomSheet/NavigableBottomSheet';
import UserMenu from './UserMenu';

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

const Navigation: FC<Props> = ({ isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isLogoutOpen, openLogout, closeLogout } = useLogout();

  const navItems = NAVIGATION_CONFIG.map(({ path, icon: Icon, labelKey }) => {
    const isActive =
      path === '/' ? pathname === '/' : pathname.startsWith(path);
    return (
      <DialGhostIconButton
        key={path}
        icon={<Icon size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
        aria-label={t(labelKey)}
        aria-current={isActive ? 'page' : undefined}
        tooltipProps={{ tooltip: t(labelKey) }}
        onClick={() => navigate(path)}
        className={isActive ? '!text-accent-primary' : undefined}
      />
    );
  });

  return (
    <>
      {/* Desktop sidebar — always mounted, hidden on mobile */}
      {!isMobile && (
        <nav
          aria-label={t(NavigationI18nKeys.AriaLabel)}
          className="flex h-full w-[60px] flex-col justify-between bg-layer-3"
        >
          <div className="flex flex-col items-center gap-2 p-2">{navItems}</div>
          <UserMenu />
        </nav>
      )}

      {/* Mobile bottom sheet — portal, zero layout impact */}
      <NavigableBottomSheet
        isOpen={isOpen}
        onClose={onClose ?? (() => undefined)}
        title={t(NavigationI18nKeys.Menu)}
      >
        <NavPageContent onLogoutRequest={openLogout} />
      </NavigableBottomSheet>

      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
};

export default memo(Navigation);
