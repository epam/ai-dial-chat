import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import {
  ModelLimitsLabels,
  ModelLimitStatus,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import { getBadgeClassName, getBadgeLabel } from '../../utils/model-limits';
import styles from './ModelLimitsSection.module.scss';

interface StatusCellProps {
  status: ModelLimitStatus;
  labels: ModelLimitsLabels;
  typography: ModelLimitsTypography;
}

/** Overall Status cell of `ModelLimitsSection`: a badge, or neutral text for `NoLimit`/`Unavailable`. */
export const StatusCell: FC<StatusCellProps> = ({
  status,
  labels,
  typography,
}) => {
  const {
    valueClassName = 'dial-small-text',
    badgeClassName = 'dial-caption-lead-semi-text',
  } = typography;

  const hasStatusBadge =
    status !== ModelLimitStatus.NoLimit &&
    status !== ModelLimitStatus.Unavailable;

  return (
    <div className="flex size-full min-w-0 items-center">
      {hasStatusBadge ? (
        <span
          className={mergeClasses(
            'inline-flex h-6 shrink-0 items-center rounded-full px-2',
            badgeClassName,
            getBadgeClassName(status, styles),
          )}
        >
          {getBadgeLabel(status, labels)}
        </span>
      ) : (
        <span className={mergeClasses(valueClassName, styles.neutralStatus)}>
          {getBadgeLabel(status, labels)}
        </span>
      )}
    </div>
  );
};
