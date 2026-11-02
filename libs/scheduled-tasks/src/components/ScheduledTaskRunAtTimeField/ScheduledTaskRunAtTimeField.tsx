import {
  Calendar,
  CalendarMode,
  type CalendarTimeFieldRenderProps,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';

/** Time control for the footer of the one-shot date-time popover: a time-mode kit `Calendar` whose clock button opens an hour/minute list. */
export const ScheduledTaskRunAtTimeField: FC<CalendarTimeFieldRenderProps> = ({
  value,
  onChange,
  onBlur,
  disabled,
  invalid,
  ariaLabel,
}) => {
  const handleChange = (next: unknown) => {
    if (typeof next === 'string') {
      onChange(next);
    }
  };

  return (
    <Calendar
      mode={CalendarMode.Time}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      disabled={disabled}
      invalid={invalid}
      labelProps={{ label: ariaLabel, className: 'sr-only' }}
      className="w-[120px] gap-y-0"
      fieldClassName="px-3 py-1.5 pe-9"
      pickerButtonClassName="size-6 inset-e-1.5"
    />
  );
};
