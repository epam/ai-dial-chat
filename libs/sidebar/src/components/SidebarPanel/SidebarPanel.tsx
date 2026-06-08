// leftActions / rightActions are header-bar positions and are independent of the `side` prop.
// `side` controls only the divider edge and the close-button placement (outer edge).
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import { type FC, useMemo } from 'react';
import { SidebarSide, type SidebarPanelProps } from '../../models/SidebarPanel';
import styles from './SidebarPanel.module.scss';

export const SidebarPanel: FC<SidebarPanelProps> = ({
  side,
  leftActions,
  rightActions,
  onClose,
  ariaLabel,
  closeLabel,
  children,
  styles: panelStyles,
  className,
}) => {
  const { colors, typography } = panelStyles ?? {};
  const noCustomFont = !typography?.fontClassName;

  const cssVars = useMemo(
    () =>
      buildCssVars({
        '--sb-bg': colors?.background,
        '--sb-border': colors?.border,
        '--sb-header-border': colors?.headerBorder,
        '--sb-font-family': noCustomFont ? typography?.fontFamily : undefined,
        '--sb-font-size': noCustomFont ? typography?.fontSize : undefined,
      }),
    [colors, typography, noCustomFont],
  );

  const dividerClass = side === 'right' ? 'border-l' : 'border-r';

  const closeButton = (
    <DialGhostIconButton
      icon={<IconX size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
      aria-label={closeLabel}
      tooltipProps={{ tooltip: closeLabel }}
      onClick={onClose}
    />
  );

  return (
    <aside
      role="complementary"
      aria-label={ariaLabel}
      style={cssVars}
      className={mergeClasses(
        styles.wrapper,
        'flex h-full w-[360px] flex-shrink-0 flex-col',
        dividerClass,
        typography?.fontClassName,
        className,
      )}
    >
      {/* Header bar */}
      <div
        className={mergeClasses(
          styles.header,
          'flex min-h-[49px] items-center border-b px-2',
        )}
      >
        {/* Left group: close button here when side=left, then leftActions */}
        <div className="flex items-center gap-1">
          {side === SidebarSide.Left && closeButton}
          {leftActions}
        </div>

        <div className="flex-1" />

        {/* Right group: rightActions, then close button when side=right */}
        <div className="flex items-center gap-1">
          {rightActions}
          {side === SidebarSide.Right && closeButton}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
};
