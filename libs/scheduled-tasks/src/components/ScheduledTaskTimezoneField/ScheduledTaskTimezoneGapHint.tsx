import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { LiveRegion } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { DEFAULT_TIMEZONE_CLASS_NAMES } from '../../constants/scheduled-task-timezone';
import type {
  ScheduledTaskTimezoneClassNames,
  ScheduledTaskTimezoneColors,
} from '../../models/scheduled-task-timezone-props';
import styles from './ScheduledTaskTimezoneField.module.scss';

export interface ScheduledTaskTimezoneGapHintProps {
  /** Hint sentence; the region stays mounted and empty while this is `undefined`, so a screen reader announces it when it appears. */
  text?: string;
  /** Color overrides. */
  colors?: ScheduledTaskTimezoneColors;
  /** Typography class overrides. */
  classNames?: ScheduledTaskTimezoneClassNames;
}

/** Non-blocking note that a one-time run falls in a daylight-saving gap and will run later. */
export const ScheduledTaskTimezoneGapHint: FC<
  ScheduledTaskTimezoneGapHintProps
> = ({ text, colors, classNames }) => (
  <LiveRegion
    className={mergeClasses(
      styles.hint,
      classNames?.hintClassName ?? DEFAULT_TIMEZONE_CLASS_NAMES.hintClassName,
    )}
    style={buildCssVars({ '--stz-hint': colors?.hintColor })}
  >
    {text}
  </LiveRegion>
);
