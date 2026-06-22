import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogItemSummary } from '../../models/entity-summary';
import { EntityTag } from '../../types/entity-tag';
import styles from './CatalogSummary.module.scss';

const TAG_LABELS: Record<EntityTag, string> = {
  [EntityTag.Free]: 'Free',
  [EntityTag.Featured]: 'Featured',
  [EntityTag.ByRequest]: 'By request',
  [EntityTag.Beta]: 'Beta',
  [EntityTag.Deprecated]: 'Deprecated',
};

/** Props for `CatalogSummary`. */
export interface CatalogSummaryProps {
  /** Summary data to render. */
  summary: CatalogItemSummary;
  /** Label shown above the daily-limit progress bar. Default: `'Daily limit'`. */
  dailyLimitLabel?: string;
  /** CSS class applied to the tag chip text. Defaults to `'dial-tiny-text'`. */
  tagClassName?: string;
  /** CSS class applied to the progress bar label. Defaults to `'dial-caption-text'`. */
  limitLabelClassName?: string;
  /** CSS class applied to the reset cadence string. Defaults to `'dial-tiny-text'`. */
  limitResetClassName?: string;
}

/** Renders the header summary block: entity tag, badge image, and daily-limit progress bar. */
export const CatalogSummary: FC<CatalogSummaryProps> = ({
  summary,
  dailyLimitLabel = 'Daily limit',
  tagClassName = 'dial-tiny-text',
  limitLabelClassName = 'dial-caption-text',
  limitResetClassName = 'dial-tiny-text',
}) => {
  const { tag, badgeImageUrl, dailyLimit } = summary;

  return (
    <div className="flex flex-col gap-3">
      {((tag != null && tag !== EntityTag.Featured) ||
        badgeImageUrl != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {tag != null && tag !== EntityTag.Featured && (
            <span
              className={mergeClasses(
                styles.tag,
                styles[`tag--${tag.toLowerCase()}`],
                tagClassName,
              )}
            >
              {TAG_LABELS[tag]}
            </span>
          )}
          {badgeImageUrl != null && (
            <img
              src={badgeImageUrl}
              alt=""
              aria-hidden="true"
              className={styles.badgeImage}
            />
          )}
        </div>
      )}

      {dailyLimit != null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={limitLabelClassName}>{dailyLimitLabel}</span>
            {dailyLimit.resetLabel != null && (
              <span
                className={mergeClasses(limitResetClassName, styles.resetLabel)}
              >
                {dailyLimit.resetLabel}
              </span>
            )}
          </div>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={dailyLimit.used}
            aria-valuemin={0}
            aria-valuemax={dailyLimit.total}
          >
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(100, (dailyLimit.used / dailyLimit.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
