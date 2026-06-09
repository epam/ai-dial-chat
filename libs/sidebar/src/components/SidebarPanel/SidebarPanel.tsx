import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import { useMemo, type FC } from 'react';
import { type SidebarPanelProps } from '../../models/SidebarPanel';
import { Header } from '../Header/Header';
import styles from './SidebarPanel.module.scss';

export const SidebarPanel: FC<SidebarPanelProps> = ({
  isOpen,
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
    <div
      className={mergeClasses(
        'h-full flex-shrink-0',
        isOpen &&
          'relative z-50 overflow-hidden transition-[width] duration-200 ease-in-out',
        className,
        styles.panel,
      )}
    >
      <aside
        role="complementary"
        aria-label={ariaLabel}
        aria-hidden={!isOpen}
        style={{ ...cssVars, ...panelCssVars }}
        className={mergeClasses(
          styles.wrapper,
          'flex h-full w-full flex-col',
          dividerClass,
          typography?.fontClassName,
        )}
      >
        <Header
          title={title}
          titleClassName={titleClassName}
          leftActions={isOpen && leftActions}
          rightActions={
            isOpen && (
              <>
                {rightActions}
                {closeButton}
              </>
            )
          }
        />

        <div
          className={mergeClasses('flex-1 overflow-y-auto p-4', bodyClassName)}
        >
          {children}
        </div>
      </aside>
    </div>
  );
};
