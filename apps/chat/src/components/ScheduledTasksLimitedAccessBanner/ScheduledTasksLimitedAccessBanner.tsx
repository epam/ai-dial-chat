import { ScheduledTasksLimitedAccessBanner as LimitedAccessBanner } from '@epam/ai-dial-scheduled-tasks';
import { memo, type FC } from 'react';

export interface Props {
  /** Bold leading title, e.g. "Limited access." */
  title: string;
  /** Normal-weight description following the title on the same line. */
  body: string;
}

/** Translated-copy adapter over the lib's limited-access banner. */
const ScheduledTasksLimitedAccessBanner: FC<Props> = ({ title, body }) => (
  <LimitedAccessBanner labels={{ title, body }} />
);

export default memo(ScheduledTasksLimitedAccessBanner);
