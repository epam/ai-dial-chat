import { mergeClasses } from '@epam/ai-dial-chat-shared';
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
  const { isOpen: isSourcesSidebarOpen, handleOpen: handleOpenSourcesSidebar } =
    useSourcesSidebar();

  return (
    <header className="relative z-30 grid min-h-[64px] w-full grid-cols-[1fr_auto_1fr] items-center border-b border-tertiary bg-layer-0 desktop:hidden">
      <div className="flex items-center gap-1 ps-3">
        {onConversationPanelToggle != null && isConversationPanel && (
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
        {onNewChat != null && isConversationPanel && (
          <div
            className={mergeClasses(
              'overflow-hidden transition-all duration-200 ease-in-out',
              isConversationPanelOpen
                ? 'max-w-0 opacity-0'
                : 'max-w-[32px] opacity-100',
            )}
          >
            <button
              type="button"
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg"
              onClick={onNewChat}
              aria-label={t(ConversationPanelI18nKeys.NewChat)}
              tabIndex={isConversationPanelOpen ? -1 : 0}
            >
              {/* Self-contained SVG so gradient url() reference stays within the same SVG fragment */}
              {/* key re-mounts the SVG on each panel-close so the pop animation re-fires */}
              <svg
                key={isConversationPanelOpen ? 'h' : 'v'}
                xmlns="http://www.w3.org/2000/svg"
                width={DIAL_ICON_SIZE.LG}
                height={DIAL_ICON_SIZE.LG}
                viewBox="0 0 24 24"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  animation: !isConversationPanelOpen
                    ? 'new-chat-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.08s both'
                    : undefined,
                }}
              >
                <defs>
                  <linearGradient
                    id="new-chat-plus-grad"
                    x1="0"
                    y1="0"
                    x2="24"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop
                      offset="0%"
                      style={{ stopColor: 'var(--bg-accent-secondary)' }}
                    />
                    <stop
                      offset="50%"
                      style={{ stopColor: 'var(--bg-accent-primary)' }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: 'var(--bg-accent-tertiary)' }}
                    />
                  </linearGradient>
                </defs>
                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                <path
                  d="M12 5v14"
                  stroke="url(#new-chat-plus-grad)"
                  strokeWidth={2}
                />
                <path
                  d="M5 12h14"
                  stroke="url(#new-chat-plus-grad)"
                  strokeWidth={2}
                />
              </svg>
            </button>
          </div>
        )}
        <DialGhostIconButton
          icon={<IconMenu2 size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
          aria-label={t(NavigationI18nKeys.OpenMenu)}
          onClick={onMenuToggle}
          className="desktop:hidden"
        />
      </div>
      <Logo />
      <div className="flex justify-end pe-3">
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
