import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Calendar,
  CalendarMode,
  type CalendarValue,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { usePickerErrorAssociation } from '../../hooks/usePickerErrorAssociation/usePickerErrorAssociation';
import {
  calendarValueToDateValue,
  calendarValueToRunAt,
  dateValueToCalendarValue,
} from '../../utils/calendar-value';
import styles from './ScheduledTaskBoundaryField.module.scss';

export interface ScheduledTaskBoundaryFieldProps {
  /** Id of the picker control. */
  id: string;
  /** Selection mode: an exact moment for hourly repeats, a whole day for day-based ones. */
  mode: CalendarMode;
  /** Label rendered above the picker by the kit Calendar. */
  label: string;
  /** Placeholder shown in the picker when unset. */
  placeholder: string;
  /** Boundary value: `YYYY-MM-DD` for `CalendarMode.Date`, `YYYY-MM-DDTHH:mm` for `CalendarMode.DateTime`. */
  value: string | undefined;
  /** Called with the next boundary value in the mode's own shape. */
  onChange: (value: string) => void;
  /** Earliest selectable day, pinned by the owning form. */
  minDate: Date;
  /** Submit-time validation error rendered under the picker, associated with it via `aria-describedby` and announced via `role="alert"` when it appears. */
  error?: string;
  /** CSS class applied to the error text. */
  errorClassName?: string;
  /** Disables the picker, e.g. while the form is submitting. */
  disabled?: boolean;
}

/** One activity-window boundary picker of the create/edit form: the kit `Calendar` in the passed mode, and the submit-time error below it. */
export const ScheduledTaskBoundaryField: FC<
  ScheduledTaskBoundaryFieldProps
> = ({
  id,
  mode,
  label,
  placeholder,
  value,
  onChange,
  minDate,
  error,
  errorClassName,
  disabled,
}) => {
  /* The picker reports its raw `CalendarValue`; the boundary value's shape
   * follows the mode — an exact moment for DateTime, a day for Date. */
  const handleChange = (next: CalendarValue) =>
    onChange(
      mode === CalendarMode.DateTime
        ? calendarValueToRunAt(next)
        : calendarValueToDateValue(next),
    );

  const errorId = usePickerErrorAssociation(id, error);

  return (
    <div className="flex flex-1 flex-col gap-1">
      <Calendar
        id={id}
        mode={mode}
        value={dateValueToCalendarValue(value)}
        onChange={handleChange}
        minDate={minDate}
        labelProps={{ label }}
        placeholder={placeholder}
        invalid={Boolean(error)}
        disabled={disabled}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className={mergeClasses(errorClassName, styles.error)}
        >
          {error}
        </p>
      )}
    </div>
  );
};
