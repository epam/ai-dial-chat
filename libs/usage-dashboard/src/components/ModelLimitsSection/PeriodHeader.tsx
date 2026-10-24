import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import { ModelLimitPeriodStatus } from '../../models/model-limits-props';
import { PeriodResetInfo } from './PeriodResetInfo';
import { PeriodStatusIndicator } from './PeriodStatusIndicator';

interface PeriodHeaderProps {
  label: string;
  periodStatus: ModelLimitPeriodStatus;
  className: string;
}

/** Period column header of `ModelLimitsSection`: label, reset-time info icon and overall Cost status indicator. */
export const PeriodHeader: FC<PeriodHeaderProps> = ({
  label,
  periodStatus,
  className,
}) => (
  <span className="flex size-full min-w-0 items-center justify-between gap-2">
    <span className="flex min-w-0 items-center gap-1">
      {/* The caps class goes on the label alone, not on the icons beside it. */}
      <span className={mergeClasses('min-w-0 truncate', className)}>
        {label}
      </span>
      <PeriodResetInfo periodStatus={periodStatus} />
    </span>
    <PeriodStatusIndicator periodStatus={periodStatus} />
  </span>
);
