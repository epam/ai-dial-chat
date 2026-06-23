import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconCircleCheckFilled } from '@tabler/icons-react';
import { FC } from 'react';
import styles from './TableView.module.scss';

interface RowValueProps {
  value: string | boolean;
  valueClassName: string;
  valueTrueClassName: string;
  checkIconClassName?: string;
  yesLabel: string;
  noLabel: string;
}

const RowValue: FC<RowValueProps> = ({
  value,
  valueClassName,
  valueTrueClassName,
  checkIconClassName,
  yesLabel,
  noLabel,
}) => {
  if (value === true) {
    return (
      <>
        <IconCircleCheckFilled
          size={DIAL_ICON_SIZE.MD}
          className={mergeClasses(checkIconClassName, styles.checkIcon)}
        />
        <span className={mergeClasses(valueTrueClassName, styles.valueTrue)}>
          {yesLabel}
        </span>
      </>
    );
  }
  if (value === false) {
    return (
      <span className={mergeClasses(valueClassName, styles.valueFalse)}>
        {noLabel}
      </span>
    );
  }
  return (
    <span className={mergeClasses(valueClassName, styles.valueText)}>
      {value}
    </span>
  );
};

/** A single row in a `TableView`. */
export interface TableViewRow {
  /** Left-column label. */
  label: string;
  /**
   * Right-column value.
   * `true` → check icon + yes label.
   * `false` → no label (secondary style).
   * `string` → plain text.
   */
  value: string | boolean;
}

/** Props for `TableView`. */
export interface TableViewProps {
  /** Section label. Defaults to `'Section'`. */
  sectionLabel?: string;
  /** Array of label-value rows to render. */
  values: TableViewRow[];
  /** CSS class for row labels. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for string and `false` values. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
  /** CSS class for `true` values. Defaults to `'dial-small-semi-text'`. */
  valueTrueClassName?: string;
  /** CSS class applied to the check icon for `true` values. */
  checkIconClassName?: string;
  /** CSS class for section headings. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
  /** Label shown for `true` boolean values. Defaults to `'Yes'`. */
  yesLabel?: string;
  /** Label shown for `false` boolean values. Defaults to `'No'`. */
  noLabel?: string;
}

/** Renders a labeled section with alternating-row key-value pairs; values may be strings or booleans. */
export const TableView: FC<TableViewProps> = ({
  sectionLabel = 'Section',
  values,
  labelClassName = 'dial-small-semi-text',
  valueClassName = 'dial-small-text',
  valueTrueClassName = 'dial-small-semi-text',
  checkIconClassName,
  sectionClassName = 'dial-caption-text',
  yesLabel = 'Yes',
  noLabel = 'No',
}) => (
  <div className="flex flex-col">
    {values != null && values.length > 0 && (
      <section>
        <p
          className={mergeClasses(
            'mb-3 mt-0',
            sectionClassName,
            styles.sectionHeading,
          )}
        >
          {sectionLabel}
        </p>
        <ul className="m-0 list-none p-0">
          {values.map((row, i) => (
            <li
              key={row.label}
              className={mergeClasses(
                'flex items-center rounded px-3 py-2',
                i % 2 === 0 ? styles.rowAlt : undefined,
              )}
            >
              <span
                className={mergeClasses(
                  labelClassName,
                  styles.label,
                  'w-2/5 shrink-0',
                )}
              >
                {row.label}
              </span>
              <div className="flex w-3/5 items-center gap-1">
                <RowValue
                  value={row.value}
                  valueClassName={valueClassName}
                  valueTrueClassName={valueTrueClassName}
                  checkIconClassName={checkIconClassName}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);
