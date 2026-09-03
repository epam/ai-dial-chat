import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
import { FC, useId } from 'react';
import type { EditorLayoutProps } from '../../models/editor-layout-props';
import styles from './EditorLayout.module.scss';

/**
 * Two-column editor shell with a header row (back button, title, actions).
 * On mobile/tablet, `actions` move out of the header into a dedicated bar
 * pinned to the bottom of the page, outside the scrollable body.
 */
export const EditorLayout: FC<EditorLayoutProps> = ({
  title,
  onBack,
  backAriaLabel = 'Back',
  actions,
  leftContent,
  rightContent,
  isSaving = false,
  labels,
  styles: stylesProp,
  dir,
}) => {
  const savingStatusId = useId();
  const savingStatusText = isSaving
    ? (labels?.savingStatusLabel ?? 'Saving')
    : '';

  const cssVars = buildCssVars({
    '--el-header-border-color': stylesProp?.colors?.headerBorderColor,
    '--el-sidebar-border-color': stylesProp?.colors?.sidebarBorderColor,
  });

  return (
    <div dir={dir} className="flex min-h-0 flex-1 flex-col" style={cssVars}>
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
        id={savingStatusId}
      >
        {savingStatusText}
      </span>

      {/* Header row */}
      <div
        className={mergeClasses(
          'flex items-center justify-between gap-2 border-b px-4 py-2 desktop:px-8 desktop:pb-3 desktop:pt-3',
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

      {/* Body: two-column on desktop, stacked on mobile */}
      <div className="flex flex-1 flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden">
        <div
          className={mergeClasses(
            rightContent != null
              ? 'desktop:w-[360px] desktop:shrink-0 desktop:overflow-y-auto desktop:border-e'
              : 'desktop:flex-1',
            'desktop:overflow-y-auto',
            rightContent != null ? styles.sidebarBorder : undefined,
          )}
        >
          {leftContent}
        </div>
        {rightContent != null && (
          <div className="desktop:flex-1 desktop:overflow-y-auto">
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
