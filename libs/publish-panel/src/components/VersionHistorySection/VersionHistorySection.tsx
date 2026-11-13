import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Badge,
  ElementSize,
  EllipsisTooltip,
  ErrorText,
  FolderName,
  LinkButton,
  LiveRegion,
  LiveRegionPoliteness,
  Skeleton,
  SkeletonVariant,
} from '@epam/ai-dial-ui-kit';
import { useEffect, useId, useState, type FC } from 'react';
import {
  VersionHistoryStatus,
  type VersionHistoryLabels,
  type VersionHistoryRow,
  type VersionHistorySectionProps,
} from '../../models/version-history';
import styles from './VersionHistorySection.module.scss';

const DEFAULT_LABELS = {
  heading: 'Versions history',
  notPublishedLabel: 'Not published',
  inReviewLabel: 'In review',
  publishedLabel: 'Published',
  unknownLabel: 'Status unavailable',
  loadingLabel: 'Loading publication statuses…',
  emptyLabel: 'No saved versions yet.',
  errorLabel: 'Could not load publication statuses.',
  retryLabel: 'Retry',
} satisfies Required<VersionHistoryLabels>;

const getStatusLabel = (
  row: VersionHistoryRow,
  labels: Required<VersionHistoryLabels>,
): string | undefined => {
  switch (row.status) {
    case VersionHistoryStatus.NotPublished:
      return labels.notPublishedLabel;
    case VersionHistoryStatus.InReview:
      return labels.inReviewLabel;
    case VersionHistoryStatus.Unknown:
      return labels.unknownLabel;
    case VersionHistoryStatus.Published:
      return labels.publishedLabel;
    default:
      return undefined;
  }
};

/** Read-only list of the saved versions of a resource with their publication status, shown at the bottom of the Save and Publish panels. */
export const VersionHistorySection: FC<VersionHistorySectionProps> = ({
  rows,
  isLoading = false,
  hasError = false,
  onRetry,
  labels = {},
  headingClassName = 'dial-body-semi-text',
  versionClassName = 'dial-small-semi-text',
  dateClassName = 'dial-small-text',
  metaClassName = 'dial-tiny-text',
  styles: stylesProp = {},
}) => {
  const headingId = useId();
  /* A region mounted together with its text is read late or not at all, so a section that opens already loading names the state one commit after it mounts. */
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  const text = { ...DEFAULT_LABELS, ...labels };
  const { colors } = stylesProp;
  const cssVars = {
    ...buildCssVars({
      '--pp-vh-heading-text': colors?.headingText,
      '--pp-vh-version-text': colors?.versionText,
      '--pp-vh-date-text': colors?.dateText,
      '--pp-vh-skeleton': colors?.skeleton,
      '--pp-vh-meta-text': colors?.metaText,
      '--pp-vh-row-border': colors?.rowBorder,
    }),
    ...stylesProp.cssVars,
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
      style={cssVars}
    >
      <h2
        id={headingId}
        className={mergeClasses(headingClassName, styles.heading)}
      >
        {text.heading}
      </h2>

      <LiveRegion visuallyHidden politeness={LiveRegionPoliteness.Polite}>
        {isMounted && isLoading && !hasError ? text.loadingLabel : ''}
      </LiveRegion>
      <LiveRegion politeness={LiveRegionPoliteness.Assertive}>
        {hasError && (
          <div className="flex flex-wrap items-center gap-2">
            <ErrorText text={text.errorLabel} />
            {onRetry && (
              <LinkButton
                label={text.retryLabel}
                size={ElementSize.Small}
                onClick={onRetry}
              />
            )}
          </div>
        )}
      </LiveRegion>

      {rows.length === 0 ? (
        <p className={mergeClasses(metaClassName, styles.meta)}>
          {text.emptyLabel}
        </p>
      ) : (
        <ul>
          {rows.map((row) => {
            const statusLabel = getStatusLabel(row, text);
            const isStatusPending = !statusLabel && isLoading && !hasError;
            return (
              <li
                key={row.id}
                className={mergeClasses('flex flex-col gap-1 py-2', styles.row)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <EllipsisTooltip
                    text={row.version}
                    className={mergeClasses(
                      'flex-initial!',
                      versionClassName,
                      styles.version,
                    )}
                  />
                  {statusLabel && <Badge label={statusLabel} />}
                  {isStatusPending && (
                    <span aria-hidden className="shrink-0">
                      <Skeleton
                        variant={SkeletonVariant.Text}
                        width="84px"
                        height="24px"
                        color={styles.skeletonColor}
                      />
                    </span>
                  )}
                  {row.modifiedAt && (
                    <span
                      className={mergeClasses(
                        'ms-auto shrink-0',
                        dateClassName,
                        styles.date,
                      )}
                    >
                      {row.modifiedAt}
                    </span>
                  )}
                </div>
                {(row.folder || row.author) && (
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    {row.folder && (
                      <FolderName
                        name={row.folder}
                        nameClassName={mergeClasses(metaClassName, styles.meta)}
                      />
                    )}
                    {row.author && (
                      <span
                        className={mergeClasses(
                          'ms-auto shrink-0',
                          metaClassName,
                          styles.meta,
                        )}
                      >
                        {row.author}
                      </span>
                    )}
                  </div>
                )}
                {row.publishedIn && (
                  <span
                    className={mergeClasses(
                      'self-end text-end',
                      metaClassName,
                      styles.meta,
                    )}
                  >
                    {row.publishedIn}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
