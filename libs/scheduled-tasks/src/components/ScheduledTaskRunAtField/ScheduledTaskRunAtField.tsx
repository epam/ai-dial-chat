import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Calendar,
  CalendarMode,
  type CalendarValue,
} from '@epam/ai-dial-ui-kit';
import { useMemo, type FC } from 'react';
import {
  calendarValueToRunAt,
  runAtToCalendarValue,
} from '../../utils/calendar-value';
import styles from './ScheduledTaskRunAtField.module.scss';

export interface ScheduledTaskRunAtFieldProps {
  /** Label rendered above the picker by the kit Calendar. */
  label: string;
  /** Current `datetime-local`-style value (`YYYY-MM-DDTHH:mm`), empty when unset. */
  value: string;
  /** Called with the next `datetime-local`-style value. */
  onChange: (value: string) => void;
  /** Submit-time validation error rendered under the picker. */
  error?: string;
  /** CSS class applied to the error text. Defaults to `'dial-small-text'`. */
  errorClassName?: string;
}

/** One-shot "run at" date-time picker for the create/edit form: the kit's masked `Calendar` whose earliest selectable moment is pinned at mount, and the submit-time error below it. */
export const ScheduledTaskRunAtField: FC<ScheduledTaskRunAtFieldProps> = ({
  label,
  value,
  onChange,
  error,
  errorClassName = 'dial-small-text',
}) => {
  /* Pinned at mount so past moments stay unselectable while the earliest
   * selectable moment stays fixed, instead of advancing on every re-render. */
  const minDate = useMemo(() => new Date(), []);

  const handleCalendarChange = (next: CalendarValue) =>
    onChange(calendarValueToRunAt(next));

  return (
    <div className="flex flex-col gap-1">
      <Calendar
        id="scheduled-task-run-at"
        mode={CalendarMode.DateTime}
        value={runAtToCalendarValue(value)}
        onChange={handleCalendarChange}
        minDate={minDate}
        labelProps={{ label, required: true }}
        invalid={Boolean(error)}
      />
      {error && (
        <p className={mergeClasses(errorClassName, styles.error)}>{error}</p>
      )}
    </div>
  );
};
