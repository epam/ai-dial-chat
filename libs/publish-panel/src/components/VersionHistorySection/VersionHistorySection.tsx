import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Badge,
  BadgeColor,
  BadgeVariant,
  ErrorText,
  LinkButton,
  LiveRegion,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import { useId, type FC } from 'react';
import {
  VersionHistoryStatus,
  type VersionHistoryLabels,
  type VersionHistoryRow,
  type VersionHistorySectionProps,
} from '../../models/version-history';
import styles from './VersionHistorySection.module.scss';

const DEFAULT_LABELS = {
  heading: 'Versions history',
  currentLabel: 'Current',
  notPublishedLabel: 'Not published',
  inReviewLabel: 'In review',
  publishedLabel: 'Published',
  publishedInLabel: 'Published in {folders}',
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
      return row.publishedFolders?.length
        ? labels.publishedInLabel.replace(
            '{folders}',
            row.publishedFolders.join(', '),
          )
        : labels.publishedLabel;
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
  metaClassName = 'dial-small-text',
  styles: stylesProp = {},
}) => {
  const headingId = useId();
  const text = { ...DEFAULT_LABELS, ...labels };
  const { colors } = stylesProp;
  const cssVars = {
    ...buildCssVars({
      '--pp-vh-heading-text': colors?.headingText,
      '--pp-vh-version-text': colors?.versionText,
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

      <LiveRegion politeness={LiveRegionPoliteness.Polite}>
        {isLoading && !hasError && (
          <span className={mergeClasses(metaClassName, styles.meta)}>
            {text.loadingLabel}
          </span>
        )}
      </LiveRegion>
      <LiveRegion politeness={LiveRegionPoliteness.Assertive}>
        {hasError && (
          <div className="flex flex-wrap items-center gap-2">
            <ErrorText text={text.errorLabel} />
            {onRetry && (
              <LinkButton label={text.retryLabel} onClick={onRetry} />
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
            const meta = [row.folder, row.modifiedAt, row.author]
              .filter((part): part is string => Boolean(part))
              .join(' · ');
            return (
              <li
                key={row.id}
                className={mergeClasses('flex flex-col gap-1 py-2', styles.row)}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={mergeClasses(
                      'min-w-0 wrap-anywhere',
                      versionClassName,
                      styles.version,
                    )}
                  >
                    {row.version}
                  </span>
                  {row.isCurrent && (
                    <Badge
                      label={text.currentLabel}
                      variant={BadgeVariant.Filled}
                      color={BadgeColor.Blue}
                    />
                  )}
                  {statusLabel && (
                    <span className="ms-auto">
                      <Badge label={statusLabel} />
                    </span>
                  )}
                </div>
                {meta && (
                  <span className={mergeClasses(metaClassName, styles.meta)}>
                    {meta}
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
