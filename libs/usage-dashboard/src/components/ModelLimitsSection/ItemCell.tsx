import {
  DeploymentIcon,
  InitialsAvatar,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { EllipsisTooltip } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import {
  ModelLimitRow,
  ModelLimitsTypography,
} from '../../models/model-limits-props';
import styles from './ModelLimitsSection.module.scss';

/** Avatar badge dimension in pixels. */
const AVATAR_SIZE = 40;

interface ItemCellProps {
  row: ModelLimitRow;
  modelTypeLabel: string;
  typography: ModelLimitsTypography;
}

/** Model identity cell of `ModelLimitsSection`: avatar, type caption, name and version. */
export const ItemCell: FC<ItemCellProps> = ({
  row,
  modelTypeLabel,
  typography,
}) => {
  const {
    nameClassName = 'dial-small-semi-text',
    modelTypeClassName = 'dial-caption-lead-semi-text',
    versionClassName = 'dial-small-text',
  } = typography;

  return (
    <div className="flex size-full min-w-0 items-center gap-3 overflow-hidden">
      <div className="shrink-0">
        <DeploymentIcon
          src={row.avatarSrc}
          size={AVATAR_SIZE}
          initialsName={row.name}
          fallback={
            <InitialsAvatar
              name={row.name}
              size={AVATAR_SIZE}
              className="rounded-xl!"
              textClassName="dial-h2-text"
            />
          }
          styles={{ badgeClassName: '!rounded-xl' }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        <span className={mergeClasses(modelTypeClassName, styles.modelType)}>
          {row.typeLabel || modelTypeLabel}
        </span>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <span
            className={mergeClasses(
              'min-w-0 truncate',
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
  );
};
