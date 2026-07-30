import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { PublishHistoryEntry } from '../../models/publish';
import { formatPublishedDate } from '../../utils/format-published-date';

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
  /** Typography class for each entry's version line. Default: `'dial-small-text text-primary'`. */
  versionClassName?: string;
  /** Typography class for each entry's publish date. Default: `'dial-small-text text-secondary'`. */
  dateClassName?: string;
  /** Typography class for the empty-state message. Default: `'dial-small-text text-secondary'`. */
  emptyStateClassName?: string;
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
  versionClassName = 'dial-small-text text-primary',
  dateClassName = 'dial-small-text text-secondary',
  emptyStateClassName = 'dial-small-text text-secondary',
}) => {
  if (isLoading) {
    return <p className={emptyStateClassName}>{loadingLabel}</p>;
  }

  if (hasError) {
    return (
      <p className={emptyStateClassName} role="alert">
        {errorLabel}
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className={emptyStateClassName}>{emptyStateLabel}</p>;
  }

  return (
    <ul>
      {entries.map((entry, index) => (
        <li
          key={`${entry.version}-${index}`}
          className={mergeClasses(
            'flex items-center justify-between gap-2 rounded-lg px-3 py-[11px]',
            index % 2 === 0 && 'bg-layer-2',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={versionClassName}>
              {versionPrefix} {entry.version}
            </span>
            {entry.version === currentVersion && (
              <DialTag
                label={currentBadgeLabel}
                className="shrink-0 !cursor-default whitespace-nowrap !border-tertiary !bg-accent-primary-alpha !text-accent-primary"
              />
            )}
          </span>
          <span className={dateClassName}>
            {formatPublishedDate(entry.publishedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
};
