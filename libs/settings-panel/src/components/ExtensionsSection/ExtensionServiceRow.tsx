import { InitialsAvatar, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Badge,
  BadgeColor,
  BadgeVariant,
  DIAL_ICON_SIZE,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { useId, type FC } from 'react';
import type {
  ExtensionServiceItem,
  ExtensionsTypography,
} from '../../models/extensions-props';
import styles from './ExtensionsSection.module.scss';

/* Grid template shared by the table's header row and every service row so the
 * three columns stay aligned on desktop (the MODEL_LIMITS_GRID_COLUMNS
 * pattern). The action track is bounded rather than `auto` so it resolves to
 * the same width in the header (visually empty) as in the action rows —
 * otherwise the `fr` columns ahead of it get different free space per row and
 * the header text drifts off the cells it labels. */
export const EXTENSIONS_GRID_COLUMNS =
  'desktop:grid-cols-[minmax(12rem,1.25fr)_minmax(0,1fr)_minmax(8rem,10rem)]';

const AVATAR_SIZE = 40;

/** Props for `ExtensionServiceRow`. */
export interface ExtensionServiceRowProps {
  /** The service rendered by this row. */
  row: ExtensionServiceItem;
  /** Typography class overrides. */
  typography: ExtensionsTypography;
}

/** One service row of the Extensions table: an avatar with an optional corner warning badge, the service name, the description, and the host-supplied trailing action or limited-access badge. */
export const ExtensionServiceRow: FC<ExtensionServiceRowProps> = ({
  row,
  typography,
}) => {
  const {
    nameClassName = 'dial-small-semi-text',
    descriptionClassName = 'dial-small-text',
    tooltipTitleClassName = 'dial-small-semi-text',
    tooltipDescriptionClassName = 'dial-small-text',
  } = typography;

  const {
    displayName,
    description,
    avatarColor,
    isWarningVisible,
    limitedAccessLabel,
    limitedAccessTooltipTitle,
    limitedAccessTooltipDescription,
    action,
  } = row;

  const isLimitedAccess = limitedAccessLabel != null;
  /* Connects the badge to its visible explanation for assistive technology. */
  const limitedAccessDescriptionId = useId();

  return (
    <div
      role="row"
      className={mergeClasses(
        'grid grid-cols-1 gap-2 px-4 py-3 desktop:min-h-16 desktop:items-center desktop:gap-4 desktop:px-6',
        EXTENSIONS_GRID_COLUMNS,
        styles.row,
      )}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <InitialsAvatar
            name={displayName}
            size={AVATAR_SIZE}
            color={avatarColor}
            textClassName="dial-h2-text"
          />
          {isWarningVisible && (
            /* The glyph is informational decoration: the connected state is
             * carried by the row's action (the Log in button) or the
             * limited-access badge's own label text, never by color alone,
             * so the glyph itself stays hidden from assistive tech. */
            <span
              className={mergeClasses(
                'absolute inset-e-[-10px] bottom-[-3px] flex',
                styles.warningBadge,
              )}
            >
              <IconAlertTriangleFilled size={DIAL_ICON_SIZE.MD} aria-hidden />
            </span>
          )}
        </div>
        <span
          className={mergeClasses(
            nameClassName,
            'min-w-0 flex-1 truncate',
            styles.name,
          )}
        >
          {displayName}
        </span>
      </div>
      <div role="cell" className="flex min-w-0 items-center">
        <span
          className={mergeClasses(
            descriptionClassName,
            'min-w-0 wrap-break-word',
            styles.description,
          )}
        >
          {description}
        </span>
      </div>
      <div role="cell" className="flex min-w-0 items-center justify-end">
        {isLimitedAccess ? (
          <div className="flex min-w-0 flex-col items-end gap-1">
            <Tooltip
              tooltip={
                <span className="flex flex-col gap-1 text-start">
                  <span className={tooltipTitleClassName}>
                    {limitedAccessTooltipTitle}
                  </span>
                  <span className={tooltipDescriptionClassName}>
                    {limitedAccessTooltipDescription}
                  </span>
                </span>
              }
            >
              <Badge
                label={limitedAccessLabel}
                variant={BadgeVariant.Filled}
                color={BadgeColor.Red}
                aria-describedby={limitedAccessDescriptionId}
              />
            </Tooltip>
            {/* Keep the explanation visible without hover for keyboard and
             * touch users; the tooltip only repeats this information. */}
            <span
              id={limitedAccessDescriptionId}
              className={mergeClasses(
                descriptionClassName,
                'min-w-0 text-end wrap-break-word',
                styles.limitedAccessDescription,
              )}
            >
              {limitedAccessTooltipDescription}
            </span>
          </div>
        ) : (
          action
        )}
      </div>
    </div>
  );
};
