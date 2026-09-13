import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ConditionalResizableContainer,
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
  isOverlay = false,
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

  /*
   * An overlay panel keeps its full size in both states and only moves, so no
   * inline width may be applied - a width animating towards 0 would reflow the
   * header actions and the list rows on every frame of the transition.
   */
  const shouldSetInlineWidth = !isOverlay && !hasFullWidthClass;

  /*
   * Resting positions of an overlay panel. A closed one leaves through the edge
   * it is anchored to, which flips with the writing direction; the open state
   * declares translate-x-0 explicitly so a transform is present in both states
   * and the browser has two transform lists to interpolate between.
   */
  const getOverlayTransformClass = () => {
    if (isOpen) {
      return 'translate-x-0';
    }
    return orientation === SidebarOrientation.Left
      ? 'ltr:-translate-x-full rtl:translate-x-full'
      : 'ltr:translate-x-full rtl:-translate-x-full';
  };

  /*
   * Only one property animates per mode, so the transition-property utility
   * is never left unset - the CSS default (`all`) would otherwise animate
   * every computed change, including the ones a resize drag makes per frame.
   */
  const getTransitionClass = () => {
    if (isOverlay) {
      return 'transition-transform duration-200 ease-in-out motion-reduce:transition-none';
    }
    if (isResizing) {
      return undefined;
    }
    return 'transition-[width] duration-200 ease-in-out motion-reduce:transition-none';
  };

  /*
   * A Left-anchored panel sits next to the navigation rail with no divider
   * of its own on that edge; add one (reusing the same --sb-border /
   * --stroke-tertiary token the wrapper's border-color already resolves to)
   * once the panel is open, so the rail and the panel read as two distinct
   * surfaces. The panel's other edge (facing the main content) stays
   * divider-less.
   */
  const navDividerClass =
    orientation === SidebarOrientation.Left && isOpen ? 'border-s' : undefined;
  const resizableSide =
    orientation === SidebarOrientation.Right
      ? ResizableContainerSide.Left
      : ResizableContainerSide.Right;
  const closeButton = onClose ? (
    <GhostIconButton
      icon={
        <IconX
          size={DIAL_ICON_SIZE.LG}
          stroke={DIAL_KIT_ICON_STROKE}
          aria-hidden
        />
      }
      aria-label={labels.closeLabel}
      tooltipProps={{ tooltip: labels.closeLabel }}
      onClick={onClose}
    />
  ) : null;

  return (
    <div
      style={shouldSetInlineWidth ? { width: panelWidth } : undefined}
      className={mergeClasses(
        'h-full flex-shrink-0 gap-3 overflow-hidden shadow-sm',
        orientation === SidebarOrientation.Left &&
          '[clip-path:inset(-24px_-24px_-24px_0)] rtl:[clip-path:inset(-24px_0_-24px_-24px)]',
        getTransitionClass(),
        /*
         * The stacking context has to outlive the close transition. Tying it to
         * isOpen dropped the panel a layer the moment the animation started, so
         * the main content painted over the still-visible panel for its whole
         * duration.
         */
        'relative z-50',
        className,
        /*
         * Applied after className so an overlay panel keeps its full width in
         * both states: it slides out of view instead of collapsing in place.
         */
        isOverlay && mergeClasses('w-full', getOverlayTransformClass()),
        styles.panel,
      )}
    >
      <ConditionalResizableContainer
        enabled={(resizable ?? false) && isOpen}
        side={resizableSide}
        ariaLabel={labels.resizeLabel ?? 'Resize panel'}
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
            'flex h-full w-full flex-col gap-3',
            navDividerClass,
            typography?.fontClassName,
          )}
        >
          <Header
            title={title}
            className={headerClassName}
            titleClassName={titleClassName}
            leftActions={leftActions}
            rightActions={
              <>
                {rightActions}
                {closeButton}
              </>
            }
          />
          <div
            className={mergeClasses(
              'flex-1 overflow-y-auto p-4 pt-0',
              bodyClassName,
            )}
          >
            {children}
          </div>
        </aside>
      </ConditionalResizableContainer>
    </div>
  );
};
