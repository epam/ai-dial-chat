import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { PublishHistoryEntry } from '../../models/publish';
import { formatPublishedDate } from '../../utils/format-published-date';
import styles from './PublishHistoryList.module.scss';

/** Props for {@link PublishHistoryList}. */
export interface PublishHistoryListProps {
  /** Previously published versions for the selected destination folder, most recent first. Filtered by the host to just that folder. */
  entries: PublishHistoryEntry[];
  /**
   * The entity's current version. The matching entry, if any, gets a
   * "Current" badge instead of the row being highlighted.
   */
  currentVersion?: string;
  /** When `true`, shows a loading message instead of `entries`/empty state. Default: `false`. */
  isLoading?: boolean;
  /** When `true` (and not `isLoading`), shows an error message instead of `entries`/empty state. Default: `false`. */
  hasError?: boolean;
  /** Prefix before each entry's version number. Default: `'Version'`. */
  versionPrefix?: string;
  /** Label for the badge on the entry matching `currentVersion`. Default: `'Current'`. */
  currentBadgeLabel?: string;
  /** Message shown when `entries` is empty. Default: `'Not published to this folder yet — this will be the first version here.'`. */
  emptyStateLabel?: string;
  /** Message shown while history is loading. Default: `'Loading history…'`. */
  loadingLabel?: string;
  /** Message shown when history failed to load. Default: `'Failed to load publish history.'`. */
  errorLabel?: string;
  /** Typography class for each entry's version line. Default: `'dial-small-text'`. */
  versionClassName?: string;
  /** Typography class for each entry's publish date. Default: `'dial-small-text'`. */
  dateClassName?: string;
  /** Typography class for the empty-state message. Default: `'dial-small-text'`. */
  emptyStateClassName?: string;
  /** Color overrides. */
  colors?: PublishHistoryListColors;
}

/** Color overrides for {@link PublishHistoryList}, applied as CSS custom properties with app theme fallbacks. */
export interface PublishHistoryListColors {
  /** Border color of the "Current" badge. Fallback: `--stroke-tertiary`. */
  currentBadgeBorder?: string;
  /** Background color of the "Current" badge. Fallback: `--bg-accent-primary-alpha`. */
  currentBadgeBackground?: string;
  /** Text color of the "Current" badge. Fallback: `--text-accent-primary`. */
  currentBadgeText?: string;
  /** Text color of each entry's version line. Fallback: `--text-primary`. */
  versionText?: string;
  /** Text color of each entry's publish date. Fallback: `--text-secondary`. */
  dateText?: string;
  /** Text color of the empty-state message. Fallback: `--text-secondary`. */
  emptyStateText?: string;
  /** Background color of every other row (odd `index`). Fallback: `--bg-layer-sunken`. */
  stripedBackground?: string;
}

/** Read-only list of previously published versions for the currently selected destination folder, with loading and empty states. */
export const PublishHistoryList: FC<PublishHistoryListProps> = ({
  entries,
  currentVersion,
  isLoading = false,
  hasError = false,
  versionPrefix = 'Version',
  currentBadgeLabel = 'Current',
  emptyStateLabel = 'Not published to this folder yet — this will be the first version here.',
  loadingLabel = 'Loading history…',
  errorLabel = 'Failed to load publish history.',
  versionClassName = 'dial-small-text',
  dateClassName = 'dial-small-text',
  emptyStateClassName = 'dial-small-text',
  colors,
}) => {
  const cssVars = buildCssVars({
    '--phl-badge-border': colors?.currentBadgeBorder,
    '--phl-badge-bg': colors?.currentBadgeBackground,
    '--phl-badge-text': colors?.currentBadgeText,
    '--phl-version-text': colors?.versionText,
    '--phl-date-text': colors?.dateText,
    '--phl-empty-text': colors?.emptyStateText,
    '--phl-striped-bg': colors?.stripedBackground,
  });

  const emptyStateClasses = mergeClasses(
    emptyStateClassName,
    styles.emptyState,
  );

  if (isLoading) {
    return (
      <p style={cssVars} className={emptyStateClasses}>
        {loadingLabel}
      </p>
    );
  }

  if (hasError) {
    return (
      <p style={cssVars} className={emptyStateClasses} role="alert">
        {errorLabel}
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p style={cssVars} className={emptyStateClasses}>
        {emptyStateLabel}
      </p>
    );
  }

  return (
    <ul style={cssVars}>
      {entries.map((entry, index) => (
        <li
          key={`${entry.version}-${index}`}
          className={mergeClasses(
            'flex items-center justify-between gap-2 rounded-lg px-3 py-[11px]',
            index % 2 === 0 && styles.stripedRow,
          )}
        >
          <span className="flex min-w-0 items-center gap-2" style={cssVars}>
            <span className={mergeClasses(versionClassName, styles.version)}>
              {versionPrefix} {entry.version}
            </span>
            {entry.version === currentVersion && (
              <DialTag
                label={currentBadgeLabel}
                className={mergeClasses(
                  'shrink-0 !cursor-default whitespace-nowrap',
                  styles.currentBadge,
                )}
              />
            )}
          </span>
          <span className={mergeClasses(dateClassName, styles.date)}>
            {formatPublishedDate(entry.publishedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
};
