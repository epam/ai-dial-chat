import { StageStatus } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Spinner } from '@epam/ai-dial-ui-kit';
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

/** Renders the icon for a stage, based on its status and whether it's currently executing. */
export const StageIcon: FC<StageIconProps> = ({
  status,
  isLive,
  runningLabel = 'Running',
  failedLabel = 'Failed',
}) => {
  if (isLive) {
    return <Spinner size={16} ariaLabel={runningLabel} />;
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
