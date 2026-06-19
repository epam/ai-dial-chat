import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import { FC } from 'react';
import type { OverviewSection } from '../../models/item-overview';
import styles from './CatalogOverview.module.scss';

interface SpecValueProps {
  value: string | boolean;
  valueClassName: string;
  valueTrueClassName: string;
  yesLabel: string;
  noLabel: string;
}

const SpecValue: FC<SpecValueProps> = ({
  value,
  valueClassName,
  valueTrueClassName,
  yesLabel,
  noLabel,
}) => {
  if (value === true) {
    return (
      <>
        <IconCircleCheckFilled
          size={DIAL_ICON_SIZE.MD}
          className={styles.specCheckIcon}
        />
        <span
          className={mergeClasses(valueTrueClassName, styles.specValueTrue)}
        >
          {yesLabel}
        </span>
      </>
    );
  }
  if (value === false) {
    return (
      <span className={mergeClasses(valueClassName, styles.specValueFalse)}>
        {noLabel}
      </span>
    );
  }
  return (
    <span className={mergeClasses(valueClassName, styles.specValueText)}>
      {value}
    </span>
  );
};

/** Props for CatalogOverview. */
export interface CatalogOverviewProps {
  /** Spec sections to render. */
  sections: OverviewSection[];
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
export const CatalogOverview: FC<CatalogOverviewProps> = ({
  sections,
  sectionClassName,
  labelClassName,
  valueClassName,
  valueTrueClassName,
  yesLabel,
  noLabel,
}) => (
  <div className="flex flex-col">
    {sections.map((section, sIdx) => (
      <div key={sIdx}>
        {sIdx > 0 && <div className="shrink-0 border-b border-tertiary" />}
        <div className="flex flex-col gap-2.5 px-[22px] py-4">
          <span
            className={mergeClasses(sectionClassName, styles.sectionHeading)}
          >
            {section.title}
          </span>
          <div className="flex flex-col">
            {section.specs.map((spec, i) => (
              <div
                key={i}
                className={mergeClasses(
                  'flex items-center gap-2 px-1 py-[5px]',
                  i % 2 !== 0 ? styles.specRowAlt : undefined,
                )}
              >
                <span
                  className={mergeClasses(labelClassName, styles.specLabel)}
                >
                  {spec.label}
                </span>
                <SpecValue
                  value={spec.value}
                  valueClassName={valueClassName}
                  valueTrueClassName={valueTrueClassName}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    ))}
  </div>
);
