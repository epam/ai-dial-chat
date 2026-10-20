import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo } from 'react';
import { Outlet, useMatch } from 'react-router';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import Logo from '../Header/Logo';
import SourcesSidebarToggle from '../Header/SourcesSidebarToggle';

/**
 * The chat routes' frame. On desktop its top bar carries the optional logo and
 * the sources toggle; the panel toggle and New chat live in the sidebar. The
 * mobile header is rendered by `Header`.
 */
const ChatLayout: FC = () => {
  const isRootRoute = !!useMatch(ROUTES.Root);
  const isHeaderLogoShown = useUiFeature(OverlayFeature.ShowHeaderLogo);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={mergeClasses(
          'hidden grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 desktop:grid',
          isRootRoute ? 'absolute inset-x-0 top-0 z-10 h-16' : 'h-16 shrink-0',
        )}
      >
        {/* An empty start cell and a logo cell keep the grid's side columns in place. */}
        <div />
        <div>{isHeaderLogoShown && <Logo />}</div>
        <div className="flex justify-end">
          <SourcesSidebarToggle />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default memo(ChatLayout);
