import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import { STATUS_SLOT_CLASS } from '../../constants/import-export-queue';
import type {
  ImportExportQueueLabels,
  ImportExportQueueStyles,
} from '../../models/import-export-queue';
import classes from '../ImportExportQueue/ImportExportQueue.module.scss';

/** Props for `ImportExportQueueHeader`. */
export interface ImportExportQueueHeaderProps {
  /** Heading text, rendered verbatim — the host composes any count into it. */
  title: string;
  /** How many jobs have failed; the badge renders only when this is positive. */
  failedCount: number;
  /** Whether the job rows are currently hidden. */
  isCollapsed: boolean;
  /** Id of the rows container the collapse toggle controls. */
  jobsId: string;
  /** User-visible string labels, supplied by the host. */
  labels: ImportExportQueueLabels;
  /** Color, typography, class, and CSS-variable overrides. */
  styles?: ImportExportQueueStyles;
  /** Called when the collapse/expand toggle is activated. */
  onToggleCollapse: () => void;
  /** Called when the close control is activated. */
  onClose: () => void;
}

/** Queue heading with its failed-job badge and the collapse and close controls. */
export const ImportExportQueueHeader: FC<ImportExportQueueHeaderProps> = ({
  title,
  failedCount,
  isCollapsed,
  jobsId,
  labels,
  styles,
  onToggleCollapse,
  onClose,
}) => {
  const typography = styles?.typography;

  return (
    <div
      className={mergeClasses(
        classes.divider,
        'mx-4 flex items-center justify-between py-3',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={mergeClasses(
            classes.text,
            'truncate',
            typography?.titleClassName || 'dial-small-paragraph-semi-text',
          )}
        >
          {title}
        </span>
        {failedCount > 0 && (
          <span
            className={mergeClasses(
              classes.failureCount,
              'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1',
              typography?.failureCountClassName ||
                'dial-small-paragraph-semi-text',
            )}
          >
            {failedCount}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <GhostIconButton
          aria-label={
            isCollapsed
              ? labels.expandQueueAriaLabel
              : labels.collapseQueueAriaLabel
          }
          size={ElementSize.Small}
          aria-expanded={!isCollapsed}
          aria-controls={jobsId}
          icon={
            isCollapsed ? (
              <IconChevronUp
                size={DIAL_ICON_SIZE.SM}
                className={classes.textSecondary}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            ) : (
              <IconChevronDown
                size={DIAL_ICON_SIZE.SM}
                className={classes.textSecondary}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            )
          }
          onClick={onToggleCollapse}
          className={STATUS_SLOT_CLASS}
        />
        <GhostIconButton
          aria-label={labels.closeQueueAriaLabel}
          size={ElementSize.Small}
          icon={
            <IconX
              size={DIAL_ICON_SIZE.SM}
              className={classes.textSecondary}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          }
          onClick={onClose}
          className={STATUS_SLOT_CLASS}
        />
      </div>
    </div>
  );
};
