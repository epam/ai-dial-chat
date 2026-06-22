import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import type { CatalogItemSummary } from '../../../models/entity-summary';
import { EntityTag } from '../../../types/entity-tag';
import styles from './Limits.module.scss';

const TAG_LABELS: Record<EntityTag, string> = {
  [EntityTag.Free]: 'Free',
  [EntityTag.Featured]: 'Featured',
  [EntityTag.ByRequest]: 'By request',
  [EntityTag.Beta]: 'Beta',
  [EntityTag.Deprecated]: 'Deprecated',
};

/** Props for `Limits`. */
export interface LimitsProps {
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
export const Limits: FC<LimitsProps> = ({
  summary,
  dailyLimitLabel = 'Daily limit',
  tagClassName = 'dial-tiny-text',
  limitLabelClassName = 'dial-caption-text',
  limitResetClassName = 'dial-tiny-text',
}) => {
  const { tag, badgeImageUrl, dailyLimit } = summary;

  console.log('Summary:', summary);
  console.log('Tag:', tag);
  return (
    <div className="flex flex-col gap-3">
      {((tag != null && tag !== EntityTag.Featured) ||
        badgeImageUrl != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {tag != null && tag !== EntityTag.Featured && (
            <DialTag
              label={TAG_LABELS[tag]}
              className={mergeClasses(
                styles.tag,
                styles[`tag--${tag}`],
                tagClassName,
              )}
            />
          )}
          {badgeImageUrl != null && (
            <img
              src={badgeImageUrl}
              alt=""
              aria-hidden="true"
              className="h-5 w-auto object-contain"
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
            className={mergeClasses(
              'h-1.5 overflow-hidden rounded-[3px]',
              styles.progressTrack,
            )}
            role="progressbar"
            aria-valuenow={dailyLimit.used}
            aria-valuemin={0}
            aria-valuemax={dailyLimit.total}
          >
            <div
              className={mergeClasses(
                'h-full rounded-[3px] [transition:width_0.3s_ease]',
                styles.progressFill,
              )}
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
