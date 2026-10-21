import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Calendar,
  CalendarMode,
  type CalendarValue,
  ErrorText,
} from '@epam/ai-dial-ui-kit';
import { useRef, type FC } from 'react';
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
  /** CSS class applied to the error text. Defaults to `'dial-tiny-text'`. */
  errorClassName?: string;
}

/** One-shot "run at" date-time picker for the create/edit form: the kit's masked `Calendar` whose earliest selectable moment is pinned at mount, and the submit-time error below it. */
export const ScheduledTaskRunAtField: FC<ScheduledTaskRunAtFieldProps> = ({
  label,
  value,
  onChange,
  error,
  errorClassName = 'dial-tiny-text',
}) => {
  /* Pinned at mount through a ref — `useMemo` is only a performance hint
   * React may discard, and the earliest selectable moment must stay fixed for
   * the component's lifetime. */
  const minDate = useRef(new Date()).current;

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
      <ErrorText
        className={mergeClasses(errorClassName, styles.error)}
        text={error}
      />
    </div>
  );
};
