import {
  mergeClasses,
  useControlErrorAssociation,
} from '@epam/ai-dial-chat-shared';
import {
  Calendar,
  CalendarMode,
  type CalendarValue,
  ErrorText,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import { useId, type FC } from 'react';
import {
  calendarValueToDateValue,
  dateValueToCalendarValue,
} from '../../utils/calendar-value';
import styles from './ScheduledTaskBoundaryField.module.scss';

export interface ScheduledTaskBoundaryFieldProps {
  /** Id of the picker control. */
  id: string;
  /** Label rendered above the picker by the kit Calendar. */
  label: string;
  /** Placeholder shown in the picker when unset. */
  placeholder: string;
  /** Boundary value: a whole local day as `YYYY-MM-DD`. */
  value: string | undefined;
  /** Called with the next `YYYY-MM-DD` boundary value. */
  onChange: (value: string) => void;
  /** Earliest selectable day, pinned by the owning form. */
  minDate: Date;
  /** Submit-time validation error rendered under the picker, associated with it via `aria-describedby` and announced through the kit `ErrorText` `announce` live region, mounted before the error arrives. */
  error?: string;
  /** CSS class applied to the error text. */
  errorClassName?: string;
  /** Disables the picker, e.g. while the form is submitting. */
  disabled?: boolean;
}

/** One activity-window boundary picker of the create/edit form: the kit date-only `Calendar`, and the submit-time error below it. */
export const ScheduledTaskBoundaryField: FC<
  ScheduledTaskBoundaryFieldProps
> = ({
  id,
  label,
  placeholder,
  value,
  onChange,
  minDate,
  error,
  errorClassName,
  disabled,
}) => {
  const handleChange = (next: CalendarValue) =>
    onChange(calendarValueToDateValue(next));

  const errorId = useId();
  useControlErrorAssociation(
    () => document.getElementById(id),
    errorId,
    Boolean(error),
  );

  return (
    <div className="flex flex-1 flex-col gap-1">
      <Calendar
        id={id}
        mode={CalendarMode.Date}
        value={dateValueToCalendarValue(value)}
        onChange={handleChange}
        minDate={minDate}
        labelProps={{ label }}
        placeholder={placeholder}
        invalid={Boolean(error)}
        disabled={disabled}
      />
      {/* Mounted before the error arrives, so it is announced; out of the column gap while empty. */}
      <ErrorText
        announce={LiveRegionPoliteness.Assertive}
        id={errorId}
        className={mergeClasses(errorClassName, styles.error)}
        text={error ?? ''}
      />
    </div>
  );
};
