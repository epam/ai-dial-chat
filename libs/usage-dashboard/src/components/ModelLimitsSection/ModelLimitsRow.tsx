import {
  DeploymentIcon,
  InitialsAvatar,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  ModelLimitRow as ModelLimitRowData,
  ModelLimitsLabels,
  ModelLimitStatus,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import { MetricCell } from './MetricCell';
import styles from './ModelLimitsSection.module.scss';

/** Grid template shared by the header row and every data row so columns stay aligned on desktop. */
export const MODEL_LIMITS_GRID_COLUMNS =
  'desktop:grid-cols-[repeat(4,minmax(0,1fr))_10rem]';

const getBadgeClassName = (status: ModelLimitStatus) => {
  switch (status) {
    case ModelLimitStatus.WithinLimits:
      return styles.defaultBadge;
    case ModelLimitStatus.RunningLow:
      return styles.warningBadge;
    case ModelLimitStatus.LimitReached:
      return styles.errorBadge;
    case ModelLimitStatus.NoLimit:
    case ModelLimitStatus.Unavailable:
      return undefined;
  }
};

const getBadgeLabel = (
  status: ModelLimitStatus,
  labels: ModelLimitsLabels,
): string => {
  switch (status) {
    case ModelLimitStatus.WithinLimits:
      return labels.withinLimitsBadgeLabel;
    case ModelLimitStatus.RunningLow:
      return labels.runningLowBadgeLabel;
    case ModelLimitStatus.LimitReached:
      return labels.limitReachedBadgeLabel;
    case ModelLimitStatus.NoLimit:
      return labels.noLimitBadgeLabel;
    case ModelLimitStatus.Unavailable:
      return labels.unavailableBadgeLabel;
  }
};

/** Props for `ModelLimitsRow`. */
export interface ModelLimitsRowProps {
  /** The row's normalized data. */
  row: ModelLimitRowData;
  /** Localized strings shared by every row. */
  labels: ModelLimitsLabels;
  /** Typography class overrides. */
  typography: ModelLimitsTypography;
  /** Avatar badge dimension in pixels. */
  avatarSize: number;
}

/** One data row of `ModelLimitsSection`'s table: model identity plus Cost/Tokens/Requests/Status cells. */
export const ModelLimitsRow: FC<ModelLimitsRowProps> = ({
  row,
  labels,
  typography,
  avatarSize,
}) => {
  const {
    nameClassName = 'dial-small-semi-text',
    modelTypeClassName = 'dial-caption-lead-semi-text',
    versionClassName = 'dial-small-text',
    valueClassName = 'dial-small-text',
    badgeClassName = 'dial-caption-lead-semi-text',
  } = typography;

  const hasStatusBadge =
    row.status !== ModelLimitStatus.NoLimit &&
    row.status !== ModelLimitStatus.Unavailable;

  return (
    <div
      role="row"
      className={mergeClasses(
        'grid grid-cols-1 gap-2 px-4 py-3 desktop:min-h-16 desktop:items-start desktop:gap-4 desktop:px-6',
        MODEL_LIMITS_GRID_COLUMNS,
        styles.row,
      )}
    >
      <div
        role="cell"
        className="flex min-w-0 items-center gap-3 overflow-hidden"
      >
        <div className="shrink-0">
          <DeploymentIcon
            src={row.avatarSrc}
            size={avatarSize}
            initialsName={row.name}
            fallback={
              <InitialsAvatar
                name={row.name}
                size={avatarSize}
                className="!rounded-xl"
                textClassName="!text-lg"
              />
            }
            styles={{ badgeClassName: '!rounded-xl' }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
          <span className={mergeClasses(modelTypeClassName, styles.modelType)}>
            {labels.modelTypeLabel}
          </span>
          <div className="flex min-w-0 items-center gap-1 overflow-hidden">
            <span
              className={mergeClasses(
                'min-w-0 flex-1 truncate',
                nameClassName,
                styles.name,
              )}
              title={row.name}
            >
              {row.name}
            </span>
            {row.version != null && (
              /* Capped at 30% of the row so a long version truncates instead of
                 squeezing the name out of the cell, matching the Catalog pattern. */
              <EllipsisTooltip
                text={row.version}
                className={mergeClasses(
                  'max-w-[30%] shrink-0',
                  versionClassName,
                  styles.version,
                )}
              />
            )}
          </div>
        </div>
      </div>

      <MetricCell
        cell={row.cost}
        mobileColumnLabel={labels.costColumnLabel}
        labels={labels}
        typography={typography}
      />
      <MetricCell
        cell={row.tokens}
        mobileColumnLabel={labels.tokensColumnLabel}
        labels={labels}
        typography={typography}
      />
      <MetricCell
        cell={row.requests}
        mobileColumnLabel={labels.requestsColumnLabel}
        labels={labels}
        typography={typography}
      />

      <div role="cell" className="flex items-center">
        {hasStatusBadge ? (
          <span
            className={mergeClasses(
              'inline-flex h-6 shrink-0 items-center rounded-full px-2',
              badgeClassName,
              getBadgeClassName(row.status),
            )}
          >
            {getBadgeLabel(row.status, labels)}
          </span>
        ) : (
          <span className={mergeClasses(valueClassName, styles.neutralStatus)}>
            {getBadgeLabel(row.status, labels)}
          </span>
        )}
      </div>
    </div>
  );
};
