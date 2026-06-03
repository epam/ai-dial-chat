import type { Stage } from '@epam/ai-dial-chat-shared';
import { StageStatus } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialSpinner } from '@epam/ai-dial-ui-kit';
import { IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { FC } from 'react';
import styles from '../StagesPanel/StagesPanel.module.scss';

interface Props {
  /** The stage status value; `null` means the stage is pending or running. */
  status: Stage['status'];
  /** Whether this stage is the currently executing (live) stage. */
  isLive: boolean;
}

/** Maps a stage status to the appropriate icon element. */
export const StageIcon: FC<Props> = ({ status, isLive }) => {
  if (!status) {
    if (!isLive) {
      return (
        <IconAlertCircle
          size={DIAL_ICON_SIZE.MD}
          className={styles.iconSecondary}
        />
      );
    }
    return <DialSpinner />;
  }
  if (status === StageStatus.Completed) {
    return (
      <IconCircleCheck
        size={DIAL_ICON_SIZE.MD}
        className={styles.iconSecondary}
      />
    );
  }
  return (
    <IconAlertCircle
      size={DIAL_ICON_SIZE.MD}
      className={styles.iconSecondary}
    />
  );
};
