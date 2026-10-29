import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  ResizeHandle,
  LiveRegion,
  LiveRegionElement,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
import { CSSProperties, FC, useEffect, useId, useRef, useState } from 'react';
import { BUILDER_FORM_CLASS } from '../../constants/public-class-names';
import type { EditorLayoutProps } from '../../models/editor-layout-props';
import {
  clampLeftColumnWidth,
  DEFAULT_LEFT_COLUMN_WIDTH,
  MAX_LEFT_COLUMN_WIDTH,
  MIN_LEFT_COLUMN_WIDTH,
} from '../../utils/clamp-left-column-width';
import styles from './EditorLayout.module.scss';

/**
 * Editor shell with a header row (back button, title, actions) and a body of
 * `leftContent` and `centerContent`, plus an optional third column,
 * `rightContent`, at the inline end.
 * On mobile/tablet, `actions` move out of the header into a dedicated bar
 * pinned to the bottom of the page, outside the scrollable body.
 */
export const EditorLayout: FC<EditorLayoutProps> = ({
  title,
  onBack,
  backAriaLabel = 'Back',
  actions,
  leftContent,
  centerContent,
  rightContent,
  resizableLeftColumn,
  isSaving = false,
  labels,
  styles: stylesProp,
  dir,
}) => {
  const savingStatusId = useId();
  const savingStatusText = isSaving
    ? (labels?.savingStatusLabel ?? 'Saving')
    : '';

  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState<number>();
  const isResizable = resizableLeftColumn != null && centerContent != null;
  const minWidth = resizableLeftColumn?.minWidth;
  const maxWidth = resizableLeftColumn?.maxWidth;
  const limits = { min: minWidth, max: maxWidth, containerWidth: bodyWidth };
  const leftWidth = isResizable
    ? clampLeftColumnWidth(resizableLeftColumn.width, limits)
    : undefined;
  /* The handle limits drags to what leaves the center column its minimum width. */
  const maxLeftWidth = clampLeftColumnWidth(
    maxWidth ?? MAX_LEFT_COLUMN_WIDTH,
    limits,
  );

  /* Re-clamp when the window shrinks so the center column never overflows. */
  useEffect(() => {
    const body = bodyRef.current;
    if (!isResizable || body == null || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => setBodyWidth(body.clientWidth));
    observer.observe(body);

    return () => observer.disconnect();
  }, [isResizable]);

  const cssVars = buildCssVars({
    '--el-header-border-color': stylesProp?.colors?.headerBorderColor,
    '--el-sidebar-border-color': stylesProp?.colors?.sidebarBorderColor,
  });

  return (
    <div
      dir={dir}
      className={mergeClasses(
        'flex min-h-0 flex-1 flex-col',
        BUILDER_FORM_CLASS.layout,
      )}
      style={cssVars}
    >
      <LiveRegion
        visuallyHidden
        as={LiveRegionElement.Span}
        id={savingStatusId}
      >
        {savingStatusText}
      </LiveRegion>

      {/* Header row */}
      <div
        className={mergeClasses(
          'flex items-center justify-between gap-2 border-b px-4 py-2 desktop:px-8 desktop:pt-3 desktop:pb-3',
          styles.headerBorder,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GhostIconButton
            icon={
              <IconArrowNarrowLeft
                size={DIAL_ICON_SIZE.LG}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
                className="rtl:scale-x-[-1]"
              />
            }
            aria-label={backAriaLabel}
            onClick={onBack}
          />
          <h1 className="dial-h2-text min-w-0 truncate">{title}</h1>
        </div>
        {actions != null && (
          <div className="hidden shrink-0 items-center gap-2 desktop:flex">
            {actions}
          </div>
        )}
      </div>

      {/* Body: two columns (three with `rightContent`) on desktop, stacked on mobile */}
      <div
        ref={bodyRef}
        className="flex flex-1 flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden"
      >
        <div
          className={mergeClasses(
            centerContent != null
              ? 'desktop:shrink-0 desktop:overflow-y-auto desktop:border-e'
              : 'desktop:flex-1',
            centerContent != null && !isResizable && 'desktop:w-[400px]',
            isResizable && 'desktop:relative desktop:w-[var(--el-left-width)]',
            'desktop:overflow-y-auto',
            centerContent != null ? styles.columnBorder : undefined,
          )}
          style={
            leftWidth != null
              ? ({ '--el-left-width': `${leftWidth}px` } as CSSProperties)
              : undefined
          }
        >
          {leftContent}
        </div>
        {isResizable && leftWidth != null && (
          <div className="relative hidden w-0 shrink-0 desktop:block">
            <ResizeHandle
              width={leftWidth}
              minWidth={minWidth ?? MIN_LEFT_COLUMN_WIDTH}
              maxWidth={maxLeftWidth}
              defaultWidth={
                resizableLeftColumn.defaultWidth ?? DEFAULT_LEFT_COLUMN_WIDTH
              }
              onWidthChange={resizableLeftColumn.onWidthChange}
              label={labels?.resizeHandleLabel ?? 'Resize columns'}
              tooltip={labels?.resizeHandleTooltip ?? 'Drag to resize'}
            />
          </div>
        )}
        {centerContent != null && (
          <div className="desktop:flex desktop:min-h-0 desktop:flex-1 desktop:flex-col desktop:overflow-y-auto">
            {centerContent}
          </div>
        )}
        {rightContent != null && (
          <div
            className={mergeClasses(
              'desktop:w-[400px] desktop:shrink-0 desktop:overflow-y-auto desktop:border-s',
              styles.columnBorder,
            )}
          >
            {rightContent}
          </div>
        )}
      </div>

      {/* Mobile/tablet action bar — kept out of the scrollable body so it never overlaps content. */}
      {actions != null && (
        <div
          className={mergeClasses(
            'flex shrink-0 flex-row-reverse items-center gap-2 border-t px-4 py-2 desktop:hidden [&>*]:flex-1',
            styles.footerBorder,
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
