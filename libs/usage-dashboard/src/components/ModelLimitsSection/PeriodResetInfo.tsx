import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconInfoCircle } from '@tabler/icons-react';
import { FC } from 'react';
import { ModelLimitPeriodStatus } from '../../models/model-limits-props';
import styles from './ModelLimitsSection.module.scss';

interface PeriodResetInfoProps {
  periodStatus: ModelLimitPeriodStatus;
}

/** Focusable info icon whose tooltip shows a period's reset time. */
export const PeriodResetInfo: FC<PeriodResetInfoProps> = ({ periodStatus }) => {
  const { resetLabel, resetIsoValue, resetAriaLabel } = periodStatus;
  if (resetLabel == null) {
    return null;
  }

  return (
    <Tooltip
      tooltip={<time dateTime={resetIsoValue}>{resetLabel}</time>}
      asChild
    >
      {/* The tooltip never reaches a touch-only device, so the icon carries the reset time as its own name. */}
      <span
        role="img"
        aria-label={resetAriaLabel ?? resetLabel}
        tabIndex={0}
        className={mergeClasses(
          'inline-flex size-11 shrink-0 items-center justify-center desktop:size-4',
          styles.secondaryValue,
        )}
      >
        <IconInfoCircle
          aria-hidden
          size={DIAL_ICON_SIZE.SM}
          stroke={DIAL_KIT_ICON_STROKE}
        />
      </span>
    </Tooltip>
  );
};
