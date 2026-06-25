import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialConditionalResizableContainer,
  DialGhostIconButton,
  ResizableContainerSide,
} from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import { useCallback, useMemo, useRef, useState, type FC } from 'react';
import { type SidebarPanelProps } from '../../models/panel-props';
import { SidebarOrientation } from '../../types/orientation';
import { Header } from '../Header/Header';
import styles from './SidebarPanel.module.scss';

export const SidebarPanel: FC<SidebarPanelProps> = ({
  isOpen,
  orientation,
  title,
  leftActions,
  rightActions,
  onClose,
  ariaLabel,
  closeLabel,
  children,
  className,
  styles: panelStyles,
  resizable,
  defaultWidth = 360,
  minWidth = 280,
  maxWidth = 600,
  onResizeStop,
}) => {
  const { colors, typography, bodyClassName, cssVars, titleClassName } =
    panelStyles ?? {};
  const noCustomFont = !typography?.fontClassName;

  const panelCssVars = useMemo(
    () =>
      buildCssVars({
        '--sb-bg': colors?.background,
        '--sb-border': colors?.border,
        '--sb-header-border': colors?.headerBorder,
        '--sb-font-family': noCustomFont ? typography?.fontFamily : undefined,
      }),
    [colors, typography, noCustomFont],
  );

  // Track actual panel width so the closing animation matches the real size,
  // not the defaultWidth prop (relevant when the panel has been resized).
  const currentWidthRef = useRef(defaultWidth);
  const [animationMaxWidth, setAnimationMaxWidth] = useState(
    isOpen ? defaultWidth : 0,
  );

  const handleResizeStop = useCallback(
    (width: number) => {
      currentWidthRef.current = width;
      onResizeStop?.(width);
    },
    [onResizeStop],
  );

  const dividerClass =
    orientation === SidebarOrientation.Right ? 'border-s' : 'border-e';
  const resizableSide =
    orientation === SidebarOrientation.Right
      ? ResizableContainerSide.Left
      : ResizableContainerSide.Right;

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
      style={{
        width: isOpen ? animationMaxWidth || currentWidthRef.current : 0,
      }}
      className={mergeClasses(
        'h-full flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out',
        isOpen && 'relative z-50',
        className,
        styles.panel,
      )}
    >
      <DialConditionalResizableContainer
        enabled={(resizable ?? false) && isOpen}
        side={resizableSide}
        defaultWidth={defaultWidth}
        minWidth={minWidth}
        maxWidth={maxWidth}
        resizeHandlerClassName={styles.resizeHandler}
        onResizeStop={handleResizeStop}
        onResize={setAnimationMaxWidth}
      >
        <aside
          role="complementary"
          aria-label={ariaLabel}
          aria-hidden={!isOpen}
          style={{ ...cssVars, ...panelCssVars }}
          className={mergeClasses(
            styles.wrapper,
            'flex h-full w-full flex-col',
            isOpen && styles.appear,
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
            className={mergeClasses(
              'flex-1 overflow-y-auto p-4',
              bodyClassName,
            )}
          >
            {children}
          </div>
        </aside>
      </DialConditionalResizableContainer>
    </div>
  );
};
