import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { OverviewSection } from '../../../models/item-overview';
import { TableView } from '../../TableView/TableView';
import styles from '../DetailsPanel.module.scss';

/** Props for Overview. */
export interface OverviewProps {
  /** Spec sections to render. */
  sections?: OverviewSection[];
  /** Typography class for section headings. */
  sectionClassName: string;
  /** Typography class for spec row labels. */
  labelClassName: string;
  /** Typography class for string and "No" values. */
  valueClassName: string;
  /** Typography class for "Yes" values. */
  valueTrueClassName: string;
  /** Label for boolean-true values. */
  yesLabel: string;
  /** Label for boolean-false values. */
  noLabel: string;
}

/** Renders the Overview tab content: full-bleed spec sections separated by dividers. */
export const Overview: FC<OverviewProps> = ({
  sections,
  sectionClassName,
  labelClassName,
  valueClassName,
  valueTrueClassName,
  yesLabel,
  noLabel,
}) => {
  if (!sections) {
    return null;
  }
  return (
    <div className="mt-4 flex flex-col gap-4">
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="flex flex-col gap-4">
          {sIdx > 0 && (
            <div
              className={mergeClasses('shrink-0 border-b', styles.divider)}
            />
          )}
          <div className="px-6">
            <TableView
              sectionLabel={section.title}
              values={section.specs}
              sectionClassName={sectionClassName}
              labelClassName={labelClassName}
              valueClassName={valueClassName}
              valueTrueClassName={valueTrueClassName}
              yesLabel={yesLabel}
              noLabel={noLabel}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
