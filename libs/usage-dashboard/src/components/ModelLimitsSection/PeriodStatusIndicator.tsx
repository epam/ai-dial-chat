import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { Tooltip } from '@epam/ai-dial-ui-kit';
import {
  IconAlertCircleFilled,
  IconAlertTriangleFilled,
} from '@tabler/icons-react';
import { FC } from 'react';
import {
  ModelLimitPeriodStatus,
  ModelLimitStatus,
} from '../../models/model-limits-props';
import styles from './ModelLimitsSection.module.scss';

interface PeriodStatusIndicatorProps {
  periodStatus: ModelLimitPeriodStatus;
}

/** Focusable overall Cost-limit indicator shared by desktop and mobile period labels. */
export const PeriodStatusIndicator: FC<PeriodStatusIndicatorProps> = ({
  periodStatus,
}) => {
  const { status, tooltipLabel } = periodStatus;
  if (
    tooltipLabel == null ||
    (status !== ModelLimitStatus.RunningLow &&
      status !== ModelLimitStatus.LimitReached)
  ) {
    return null;
  }

  const Icon =
    status === ModelLimitStatus.LimitReached
      ? IconAlertCircleFilled
      : IconAlertTriangleFilled;

  return (
    <Tooltip tooltip={tooltipLabel} asChild>
      <span
        role="img"
        aria-label={tooltipLabel}
        tabIndex={0}
        className={mergeClasses(
          'inline-flex size-11 shrink-0 items-center justify-center desktop:size-4',
          status === ModelLimitStatus.LimitReached
            ? styles.errorIndicator
            : styles.warningIndicator,
        )}
      >
        <Icon aria-hidden size={16} />
      </span>
    </Tooltip>
  );
};
