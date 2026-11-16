import {
  buildCssVars,
  mergeClasses,
  useIsPhone,
} from '@epam/ai-dial-chat-shared';
import {
  BottomSheet,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownOverlayRole,
  LinkButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown } from '@tabler/icons-react';
import { useMemo, useState, type FC } from 'react';
import {
  DEFAULT_TIMEZONE_CLASS_NAMES,
  DEFAULT_TIMEZONE_LABELS,
} from '../../constants/scheduled-task-timezone';
import type {
  ScheduledTaskTimezoneClassNames,
  ScheduledTaskTimezoneColors,
  ScheduledTaskTimezoneFieldProps,
  ScheduledTaskTimezoneLabels,
  ScheduledTaskTimezoneOption,
} from '../../models/scheduled-task-timezone-props';
import styles from './ScheduledTaskTimezoneField.module.scss';
import { ScheduledTaskTimezoneList } from './ScheduledTaskTimezoneList';

/** Replaces every label the host leaves out with its English default. */
export const resolveTimezoneLabels = (
  labels?: ScheduledTaskTimezoneLabels,
): Required<ScheduledTaskTimezoneLabels> => ({
  ...DEFAULT_TIMEZONE_LABELS,
  ...Object.fromEntries(
    Object.entries(labels ?? {}).filter(([, label]) => label !== undefined),
  ),
});

/** Replaces every class the host leaves out with its kit type-scale default. */
export const resolveTimezoneClassNames = (
  classNames?: ScheduledTaskTimezoneClassNames,
): Required<ScheduledTaskTimezoneClassNames> => ({
  ...DEFAULT_TIMEZONE_CLASS_NAMES,
  ...Object.fromEntries(
    Object.entries(classNames ?? {}).filter(
      ([, className]) => className !== undefined,
    ),
  ),
});

/** Maps the host's color overrides to the `--stz-*` custom properties the stylesheet reads. */
export const buildTimezoneCssVars = (colors?: ScheduledTaskTimezoneColors) =>
  buildCssVars({
    '--stz-link': colors?.linkColor,
    '--stz-heading': colors?.headingColor,
    '--stz-offset': colors?.offsetColor,
    '--stz-name': colors?.nameColor,
    '--stz-abbreviation': colors?.abbreviationColor,
    '--stz-hint': colors?.hintColor,
    '--stz-shadow': colors?.shadowColor,
  });

/** The selected zone as the kit writes it next to a time, `(GMT+01:00) Europe/Berlin`; the bare id when the zone is not in `options`. */
export const getTimezoneSummary = (
  options: readonly ScheduledTaskTimezoneOption[],
  timezoneId: string,
): string => {
  const option = options.find((candidate) => candidate.id === timezoneId);
  return option ? `(${option.offsetLabel}) ${option.id}` : timezoneId;
};

/** A "Change timezone" link that opens a searchable, grouped list of IANA zones in a popover, or a bottom sheet on phones. */
export const ScheduledTaskTimezoneField: FC<
  ScheduledTaskTimezoneFieldProps
> = ({
  id,
  options,
  value,
  onChange,
  browserTimezoneId,
  disabled,
  isSummaryShown = true,
  labels,
  colors,
  classNames,
}) => {
  const isPhone = useIsPhone();
  const [isOpen, setIsOpen] = useState(false);
  const resolvedLabels = useMemo(() => resolveTimezoneLabels(labels), [labels]);
  const resolvedClassNames = useMemo(
    () => resolveTimezoneClassNames(classNames),
    [classNames],
  );
  const cssVars = useMemo(() => buildTimezoneCssVars(colors), [colors]);
  const browserOption = useMemo(
    () => options.find((option) => option.id === browserTimezoneId),
    [options, browserTimezoneId],
  );

  const selectedSummary = getTimezoneSummary(options, value);

  const handleSelect = (timezoneId: string) => {
    setIsOpen(false);
    onChange(timezoneId);
  };

  const list = (
    <ScheduledTaskTimezoneList
      options={options}
      value={value}
      browserOption={browserOption}
      onSelect={handleSelect}
      labels={resolvedLabels}
      classNames={resolvedClassNames}
      cssVars={cssVars}
    />
  );

  const link = (
    <LinkButton
      id={id}
      label={resolvedLabels.changeLabel}
      textClassName={resolvedClassNames.linkClassName}
      className={styles.link}
      disabled={disabled}
      iconAfter={
        <IconChevronDown
          size={16}
          stroke={DIAL_KIT_ICON_STROKE}
          className={mergeClasses(styles.chevron, isOpen && styles.chevronOpen)}
          aria-hidden="true"
        />
      }
      {...(isPhone
        ? {
            'aria-haspopup': 'dialog' as const,
            'aria-expanded': isOpen,
            onClick: () => setIsOpen(true),
          }
        : {})}
    />
  );

  const summary = isSummaryShown && (
    <span
      className={mergeClasses(styles.summary, resolvedClassNames.rowClassName)}
    >
      {selectedSummary}
    </span>
  );

  if (isPhone) {
    return (
      <div style={cssVars} className={styles.field}>
        {summary}
        {link}
        <BottomSheet
          open={isOpen}
          title={resolvedLabels.dialogAriaLabel}
          onClose={() => setIsOpen(false)}
        >
          {list}
        </BottomSheet>
      </div>
    );
  }

  return (
    <div style={cssVars} className={styles.field}>
      {summary}
      <Dropdown
        open={isOpen}
        onOpenChange={setIsOpen}
        disabled={disabled}
        overlayRole={DropdownOverlayRole.Dialog}
        overlayAriaLabel={resolvedLabels.dialogAriaLabel}
        matchReferenceWidth={false}
        placement="bottom-start"
        listClassName={styles.popover}
        listStyle={cssVars}
        initialFocus={0}
        renderOverlay={() => list}
      >
        {link}
      </Dropdown>
    </div>
  );
};
