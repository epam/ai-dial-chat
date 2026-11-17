import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Highlight,
  LiveRegion,
  MenuItem,
  MenuItemMark,
  NoDataContent,
  Search,
} from '@epam/ai-dial-ui-kit';
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
} from 'react';
import type {
  ScheduledTaskTimezoneClassNames,
  ScheduledTaskTimezoneLabels,
  ScheduledTaskTimezoneOption,
} from '../../models/scheduled-task-timezone-props';
import {
  filterTimezoneOptions,
  normalizeTimezoneQuery,
} from '../../utils/timezone-search';
import styles from './ScheduledTaskTimezoneField.module.scss';

export interface ScheduledTaskTimezoneListProps {
  /** Selectable zones in display order. */
  options: ScheduledTaskTimezoneOption[];
  /** Id of the selected zone. */
  value: string;
  /** The viewer's own zone, listed first under its own heading. */
  browserOption?: ScheduledTaskTimezoneOption;
  /** Called with the id of the zone the user picked. */
  onSelect: (timezoneId: string) => void;
  /** Fully resolved labels. */
  labels: Required<ScheduledTaskTimezoneLabels>;
  /** Fully resolved typography classes. */
  classNames: Required<ScheduledTaskTimezoneClassNames>;
  /** CSS custom properties of the host's colors; set here because the panel is portalled away from the field. */
  cssVars: CSSProperties;
}

interface RowProps {
  option: ScheduledTaskTimezoneOption;
  isSelected: boolean;
  query: string;
  rowClassName: string;
  onSelect: (timezoneId: string) => void;
}

const OPTION_SELECTOR = '[role="option"]';

const TimezoneRow: FC<RowProps> = memo(
  ({ option, isSelected, query, rowClassName, onSelect }) => (
    <MenuItem
      role="option"
      aria-selected={isSelected}
      selected={isSelected}
      mark={MenuItemMark.Tint}
      className={styles.row}
      onClick={() => onSelect(option.id)}
    >
      <span className={mergeClasses(styles.rowContent, rowClassName)}>
        <span className={styles.offset}>
          <Highlight text={option.offsetLabel} query={query} maxLines={1} />
        </span>
        <span className={styles.name}>
          <Highlight text={option.id} query={query} maxLines={1} />
        </span>
        {option.abbreviation && (
          <span className={styles.abbreviation}>
            <span aria-hidden="true">•</span>
            <Highlight text={option.abbreviation} query={query} maxLines={1} />
          </span>
        )}
      </span>
    </MenuItem>
  ),
);
TimezoneRow.displayName = 'TimezoneRow';

/** Search field and grouped, filterable list of time zones shown inside the picker's popover or sheet. */
export const ScheduledTaskTimezoneList: FC<ScheduledTaskTimezoneListProps> = ({
  options,
  value,
  browserOption,
  onSelect,
  labels,
  classNames,
  cssVars,
}) => {
  const [query, setQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const yourZoneHeadingId = useId();
  const allZonesHeadingId = useId();
  const normalizedQuery = normalizeTimezoneQuery(query);
  const isSearching = normalizedQuery.length > 0;

  const results = useMemo(
    () => filterTimezoneOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    const panel = panelRef.current;
    panel?.querySelector<HTMLInputElement>('input')?.focus();
    panel
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const focusOption = (index: number) => {
    const rows =
      panelRef.current?.querySelectorAll<HTMLElement>(OPTION_SELECTOR);
    if (!rows?.length) return;
    rows[Math.min(Math.max(index, 0), rows.length - 1)].focus();
  };

  const focusSearch = () =>
    panelRef.current?.querySelector<HTMLInputElement>('input')?.focus();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isOnOption = target.matches(OPTION_SELECTOR);
    const rows = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(OPTION_SELECTOR) ?? [],
    );
    const current = rows.indexOf(target);

    if (
      event.key === 'ArrowDown' &&
      (isOnOption || target.tagName === 'INPUT')
    ) {
      event.preventDefault();
      focusOption(isOnOption ? current + 1 : 0);
    } else if (event.key === 'ArrowUp' && isOnOption) {
      event.preventDefault();
      if (current <= 0) focusSearch();
      else focusOption(current - 1);
    } else if (event.key === 'Home' && isOnOption) {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End' && isOnOption) {
      event.preventDefault();
      focusOption(rows.length - 1);
    }
  };

  const renderRows = (rows: ScheduledTaskTimezoneOption[]) =>
    rows.map((option) => (
      <TimezoneRow
        key={option.id}
        option={option}
        isSelected={option.id === value}
        query={normalizedQuery}
        rowClassName={classNames.rowClassName}
        onSelect={onSelect}
      />
    ));

  const renderGroup = (
    headingId: string,
    heading: string,
    rows: ScheduledTaskTimezoneOption[],
  ) => (
    <div role="group" aria-labelledby={headingId}>
      <div
        id={headingId}
        className={mergeClasses(styles.heading, classNames.headingClassName)}
      >
        {heading}
      </div>
      {renderRows(rows)}
    </div>
  );

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={cssVars}
      onKeyDown={handleKeyDown}
    >
      <Search
        value={query}
        onChange={(next) => setQuery(next ?? '')}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchAriaLabel}
        clearLabel={labels.clearSearchAriaLabel}
      />
      <LiveRegion visuallyHidden>
        {isSearching && results.length > 0
          ? labels.resultsCountLabel(results.length)
          : ''}
      </LiveRegion>
      <div className={styles.results}>
        {results.length === 0 ? (
          <NoDataContent
            title={labels.noResultsTitle}
            description={labels.noResultsDescription}
            live
          />
        ) : (
          <div role="listbox" aria-label={labels.listAriaLabel}>
            {isSearching && renderRows(results)}
            {!isSearching &&
              browserOption &&
              renderGroup(yourZoneHeadingId, labels.yourZoneHeading, [
                browserOption,
              ])}
            {!isSearching &&
              renderGroup(allZonesHeadingId, labels.allZonesHeading, results)}
          </div>
        )}
      </div>
    </div>
  );
};
