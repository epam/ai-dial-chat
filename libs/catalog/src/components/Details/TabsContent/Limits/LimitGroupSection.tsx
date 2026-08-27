import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { UsageLimitGroup } from '../../../../models/item-details-data';
import type { LimitRowClassNames } from '../../../../models/limits-props';
import { LimitRow } from './LimitRow';
import styles from './Limits.module.scss';

interface LimitGroupSectionProps extends LimitRowClassNames {
  group: UsageLimitGroup;
  sectionClassName: string;
}

/** One named limits group (e.g. token limits, cost limits) rendered as a heading over its rows. */
export const LimitGroupSection: FC<LimitGroupSectionProps> = ({
  group,
  sectionClassName,
  labelClassName,
  captionClassName,
  valueClassName,
  noteValueClassName,
  noteClassName,
}) => (
  <section>
    <p
      className={mergeClasses(
        'mb-3 mt-0',
        sectionClassName,
        styles.sectionHeading,
      )}
    >
      {group.label}
    </p>
    <ul className="m-0 flex list-none flex-col p-0">
      {group.rows.map((row) => (
        <LimitRow
          key={row.label}
          row={row}
          labelClassName={labelClassName}
          captionClassName={captionClassName}
          valueClassName={valueClassName}
          noteValueClassName={noteValueClassName}
          noteClassName={noteClassName}
        />
      ))}
    </ul>
  </section>
);
