import {
  DeploymentIcon,
  InitialsAvatar,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { ElementSize, ProgressBar } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  ModelLimitMetricCell,
  ModelLimitMetricKind,
  ModelLimitRow as ModelLimitRowData,
  ModelLimitsLabels,
  ModelLimitStatus,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
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

const getProgressFillClassName = (status: ModelLimitStatus | undefined) => {
  switch (status) {
    case ModelLimitStatus.RunningLow:
      return styles.progressFillWarning;
    case ModelLimitStatus.LimitReached:
      return styles.progressFillError;
    default:
      return styles.progressFillDefault;
  }
};

interface MetricCellProps {
  cell: ModelLimitMetricCell;
  mobileColumnLabel: string;
  labels: ModelLimitsLabels;
  typography: ModelLimitsTypography;
}

/** Renders one Cost/Tokens/Requests cell in one of its three shapes: finite (progress bar), unlimited, or unavailable. */
const MetricCell: FC<MetricCellProps> = ({
  cell,
  mobileColumnLabel,
  labels,
  typography,
}) => {
  const {
    valueClassName = 'dial-small-text',
    secondaryValueClassName = 'dial-tiny-text',
  } = typography;

  const value = (
    <span className={mergeClasses(valueClassName, styles.value)}>
      {cell.usedLabel}
    </span>
  );

  return (
    <div role="cell" className="flex min-w-0 flex-col gap-1 py-2 desktop:py-0">
      <span
        className={mergeClasses(
          'dial-caption-lead-semi-text mobile:block desktop:hidden',
          styles.mobileColumnLabel,
        )}
      >
        {mobileColumnLabel}
      </span>
      {cell.kind === ModelLimitMetricKind.Unlimited && (
        <div className="flex min-w-0 flex-col gap-1">
          {value}
          <span
            className={mergeClasses(
              secondaryValueClassName,
              styles.secondaryValue,
            )}
          >
            {labels.noLimitLabel}
          </span>
        </div>
      )}
      {cell.kind === ModelLimitMetricKind.Unavailable && (
        <span
          className={mergeClasses(
            secondaryValueClassName,
            styles.secondaryValue,
          )}
        >
          {labels.unavailableLabel}
        </span>
      )}
      {cell.kind === ModelLimitMetricKind.Finite && (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
            {value}
            <span
              className={mergeClasses(valueClassName, styles.secondaryValue)}
            >
              / {cell.totalLabel}
            </span>
          </div>
          <ProgressBar
            value={Math.min(cell.usedPercent ?? 0, 100)}
            max={100}
            size={ElementSize.Small}
            className={mergeClasses(
              '!h-1 w-full',
              styles.progressTrack,
              getProgressFillClassName(cell.status),
            )}
            aria-label={mobileColumnLabel}
            aria-valuetext={cell.ariaLabel}
          />
        </div>
      )}
    </div>
  );
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
      <div role="cell" className="flex min-w-0 items-center gap-3">
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
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={mergeClasses(modelTypeClassName, styles.modelType)}>
            {labels.modelTypeLabel}
          </span>
          <div className="flex min-w-0 items-center gap-1">
            <span
              className={mergeClasses('truncate', nameClassName, styles.name)}
              title={row.name}
            >
              {row.name}
            </span>
            {row.version != null && (
              <span
                className={mergeClasses(
                  'shrink-0',
                  versionClassName,
                  styles.version,
                )}
              >
                {row.version}
              </span>
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
