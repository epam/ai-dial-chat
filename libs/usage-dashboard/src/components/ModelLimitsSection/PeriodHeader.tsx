import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { ModelLimitPeriodStatus } from '../../models/model-limits-props';
import styles from './ModelLimitsSection.module.scss';
import { PeriodStatusIndicator } from './PeriodStatusIndicator';

interface PeriodHeaderProps {
  label: string;
  periodStatus: ModelLimitPeriodStatus;
  className: string;
  resetLabelClassName: string;
}

/** Period column header of `ModelLimitsSection`: label, reset line and overall Cost status indicator. */
export const PeriodHeader: FC<PeriodHeaderProps> = ({
  label,
  periodStatus,
  className,
  resetLabelClassName,
}) => (
  <span className="flex size-full min-w-0 items-center justify-between gap-2">
    <span className="flex min-w-0 flex-col">
      {/* The caps class goes on the label alone: on the wrapper it uppercased the reset line too. */}
      <span className={mergeClasses('min-w-0 truncate', className)}>
        {label}
      </span>
      {periodStatus.resetLabel != null && (
        <>
          {/* See UsageLimitCard: the spoken form rides an sr-only sibling
              because `aria-label` is not reliably supported on a `<time>`. */}
          <time
            dateTime={periodStatus.resetIsoValue}
            aria-hidden={periodStatus.resetAriaLabel != null || undefined}
            className={mergeClasses(
              'block break-words whitespace-normal',
              resetLabelClassName,
              styles.secondaryValue,
            )}
          >
            {periodStatus.resetLabel}
          </time>
          {periodStatus.resetAriaLabel != null && (
            <span className="sr-only">{periodStatus.resetAriaLabel}</span>
          )}
        </>
      )}
    </span>
    <PeriodStatusIndicator periodStatus={periodStatus} />
  </span>
);
