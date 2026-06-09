import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import { type FC, useMemo } from 'react';
import { SidebarSide, type SidebarPanelProps } from '../../models/SidebarPanel';
import { Header } from '../Header/Header';
import styles from './SidebarPanel.module.scss';

export const SidebarPanel: FC<SidebarPanelProps> = ({
  side,
  title,
  titleClassName,
  leftActions,
  rightActions,
  onClose,
  ariaLabel,
  closeLabel,
  children,
  styles: panelStyles,
  className,
  bodyClassName,
  cssVars,
}) => {
  const { colors, typography } = panelStyles ?? {};
  const noCustomFont = !typography?.fontClassName;

  const panelCssVars = useMemo(
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

  const closeButton = onClose ? (
    <DialGhostIconButton
      icon={<IconX size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
      aria-label={closeLabel}
      tooltipProps={{ tooltip: closeLabel }}
      onClick={onClose}
    />
  ) : null;

  return (
    <aside
      role="complementary"
      aria-label={ariaLabel}
      style={{ ...cssVars, ...panelCssVars }}
      className={mergeClasses(
        styles.wrapper,
        'flex h-full flex-shrink-0 flex-col',
        dividerClass,
        typography?.fontClassName,
        className,
      )}
    >
      <Header
        title={title}
        titleClassName={titleClassName}
        leftActions={
          <>
            {side === SidebarSide.Left && closeButton}
            {leftActions}
          </>
        }
        rightActions={
          <>
            {rightActions}
            {side === SidebarSide.Right && closeButton}
          </>
        }
      />

      <div
        className={mergeClasses('flex-1 overflow-y-auto p-4', bodyClassName)}
      >
        {children}
      </div>
    </aside>
  );
};
