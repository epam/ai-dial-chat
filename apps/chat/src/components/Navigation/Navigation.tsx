import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import { NavigationI18nKeys } from '../../constants/translation-keys';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import UserMenu from './UserMenu';

interface Props {
  /** Controls whether the mobile drawer overlay is open. Ignored on desktop. */
  isOpen?: boolean;
  /** Called when the mobile drawer should close. Ignored on desktop. */
  onClose?: () => void;
}

const Navigation: FC<Props> = ({ isOpen = false, onClose }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Prevent body scroll while the mobile drawer is open
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, isOpen]);

  // Close the mobile drawer on Escape
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, isOpen, onClose]);

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
        onClick={() => {
          navigate(path);
          if (isMobile) onClose?.();
        }}
        className={isActive ? 'text-accent-primary' : undefined}
      />
    );
  });

  // Desktop: static inline nav in the flex row
  if (!isMobile) {
    return (
      <nav
        aria-label={t(NavigationI18nKeys.AriaLabel)}
        className="flex h-full w-[60px] flex-col justify-between bg-layer-3"
      >
        <div className="flex flex-col items-center gap-2 p-2">{navItems}</div>
        <UserMenu />
      </nav>
    );
  }

  // Mobile: portal-based overlay drawer — nothing is added to the flex row
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={mergeClasses(
          'bg-black/50 fixed inset-0 z-40 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer panel */}
      <nav
        aria-label={t(NavigationI18nKeys.AriaLabel)}
        aria-hidden={!isOpen}
        className={mergeClasses(
          'fixed inset-y-0 left-0 z-50 flex w-[60px] flex-col justify-between bg-layer-3 transition-transform duration-200 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex flex-col items-center gap-2 p-2">
          <DialGhostIconButton
            icon={<IconX size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(NavigationI18nKeys.CloseMenu)}
            onClick={onClose}
          />
          {navItems}
        </div>
        <UserMenu />
      </nav>
    </>,
    document.body,
  );
};

export default memo(Navigation);
