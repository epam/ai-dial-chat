import { StageStatus } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialSpinner } from '@epam/ai-dial-ui-kit';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { FC } from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

/** Props for {@link StageIcon}. */
export interface StageIconProps {
  /** The stage status value; `null` means the stage is pending or running. */
  status: StageStatus | null;
  /** Whether this stage is the currently executing (live) stage. */
  isLive: boolean;
  /** Accessible label announced for the running spinner. Defaults to `'Running'`. */
  runningLabel?: string;
  /** Accessible label announced (visually hidden) alongside a failed stage's icon. Defaults to `'Failed'`. */
  failedLabel?: string;
}

/**
 * The row's single icon slot, filled by priority: exception (failed, or
 * running via a spinner) always wins; everything else — completed, or a
 * settled-but-unresolved stage from an aborted stream — falls back to one
 * uniform check glyph, the same `IconCheck` glyph and size as the
 * `CollapsedGroup` summary's own "Executed N steps" check, but in a quiet
 * grey ink rather than the summary's success color — the summary is the one
 * place that should read as a vivid confirmation, not every row. There is
 * no separate "pending" glyph: the quiet tier is intentionally a single
 * glyph, not a per-state icon set.
 *
 * The icon itself is `aria-hidden` (decorative) — status is also carried by
 * text: failed stages get a visually-hidden label here, and their row name
 * gets the warning ink color at the call site.
 */
export const StageIcon: FC<StageIconProps> = ({
  status,
  isLive,
  runningLabel = 'Running',
  failedLabel = 'Failed',
}) => {
  if (isLive) {
    return <DialSpinner size={16} ariaLabel={runningLabel} />;
  }

  if (status === StageStatus.Failed) {
    return (
      <>
        <IconAlertCircle
          size={DIAL_ICON_SIZE.MD}
          className={styles.iconError}
          aria-hidden
        />
        <span className="sr-only">{failedLabel}</span>
      </>
    );
  }

  return (
    <IconCheck
      size={DIAL_ICON_SIZE.SM}
      className={styles.iconCompleted}
      aria-hidden
    />
  );
};
