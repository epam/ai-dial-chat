import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialConditionalResizableContainer,
  GhostIconButton,
  ResizableContainerSide,
} from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { type SidebarPanelProps } from '../../models/panel-props';
import { SidebarOrientation } from '../../types/orientation';
import { Header } from '../Header/Header';
import styles from './SidebarPanel.module.scss';

/** Collapsible, optionally resizable side panel with a header bar, used as the shell for sidebar content. */
export const SidebarPanel: FC<SidebarPanelProps> = ({
  isOpen,
  orientation,
  title,
  leftActions,
  rightActions,
  onClose,
  labels,
  children,
  styles: panelStyles,
  resizable,
  defaultWidth = 360,
  minWidth = 280,
  maxWidth = 600,
  onResizeStop,
}) => {
  const {
    colors,
    typography,
    bodyClassName,
    cssVars,
    titleClassName,
    className,
    headerClassName,
  } = panelStyles ?? {};

  const panelCssVars = useMemo(
    () =>
      buildCssVars({
        '--sb-bg': colors?.background,
        '--sb-border': colors?.border,
        '--sb-border-inline-end': colors?.borderInlineEnd,
        '--sb-text': colors?.text,
        '--sb-resize-handler': colors?.resizeHandler,
      }),
    [colors],
  );

  /*
   * Track actual panel width so the closing animation matches the real size,
   * not the defaultWidth prop (relevant when the panel has been resized).
   */
  const currentWidthRef = useRef(defaultWidth);
  const [animationMaxWidth, setAnimationMaxWidth] = useState(
    isOpen ? defaultWidth : 0,
  );

  /* Suppress the width transition while the user is actively dragging so the
   * outer div tracks the inner re-resizable element without lag.  The
   * transition is still applied for the open/close animation. */
  const [isResizing, setIsResizing] = useState(false);

  /* Stores the user's manually chosen width together with the defaultWidth it
   * was set for. On breakpoint crossing the stored width is restored only when
   * defaultWidth returns to the same value (e.g. desktop→mobile→desktop
   * brings back the desktop custom size). Cleared on panel close. */
  const userChosenWidthRef = useRef<{
    forDefault: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setAnimationMaxWidth(defaultWidth);
      currentWidthRef.current = defaultWidth;
      setIsResizing(false);
      userChosenWidthRef.current = null;
    } else {
      const stored = userChosenWidthRef.current;
      const targetWidth =
        stored?.forDefault === defaultWidth ? stored.width : defaultWidth;
      setAnimationMaxWidth(targetWidth);
      currentWidthRef.current = targetWidth;
    }
  }, [isOpen, defaultWidth]);

  const handleResize = useCallback((width: number) => {
    setIsResizing(true);
    setAnimationMaxWidth(width);
  }, []);

  const handleResizeStop = useCallback(
    (width: number) => {
      userChosenWidthRef.current = { forDefault: defaultWidth, width };
      currentWidthRef.current = width;
      setAnimationMaxWidth(width);
      setIsResizing(false);
      onResizeStop?.(width);
    },
    [defaultWidth, onResizeStop],
  );

  const panelWidth = isOpen ? animationMaxWidth || currentWidthRef.current : 0;

  /*
   * Check if the className contains w-full to allow full-width override.
   * When w-full is present, don't set inline width so the class takes effect.
   */
  const hasFullWidthClass = className?.includes('w-full');

  const dividerClass =
    orientation === SidebarOrientation.Right ? 'border-s' : 'border-e';
  const resizableSide =
    orientation === SidebarOrientation.Right
      ? ResizableContainerSide.Left
      : ResizableContainerSide.Right;
  const closeButton = onClose ? (
    <GhostIconButton
      icon={<IconX size={DIAL_ICON_SIZE.LG} stroke={1.5} aria-hidden />}
      aria-label={labels.closeLabel}
      tooltipProps={{ tooltip: labels.closeLabel }}
      onClick={onClose}
    />
  ) : null;

  return (
    <div
      style={
        hasFullWidthClass
          ? undefined
          : {
              width: panelWidth,
            }
      }
      className={mergeClasses(
        'h-full flex-shrink-0 overflow-hidden',
        !isResizing && 'transition-[width] duration-200 ease-in-out',
        isOpen && 'relative z-50',
        className,
        styles.panel,
      )}
    >
      <DialConditionalResizableContainer
        enabled={(resizable ?? false) && isOpen}
        side={resizableSide}
        width={
          isOpen ? animationMaxWidth || currentWidthRef.current : undefined
        }
        defaultWidth={defaultWidth}
        minWidth={minWidth}
        maxWidth={maxWidth}
        resizeHandlerClassName={styles.resizeHandler}
        onResizeStop={handleResizeStop}
        onResize={handleResize}
      >
        <aside
          role="complementary"
          aria-label={labels.ariaLabel}
          inert={!isOpen}
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
            className={headerClassName}
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
