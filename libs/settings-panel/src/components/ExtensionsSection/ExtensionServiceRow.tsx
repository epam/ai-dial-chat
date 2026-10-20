import { InitialsAvatar, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Badge,
  BadgeColor,
  BadgeVariant,
  DIAL_ICON_SIZE,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { type FC } from 'react';
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
            textClassName="text-lg"
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
      <div role="cell" className="flex items-center justify-end">
        {isLimitedAccess ? (
          /* The position sits on the tooltip's own trigger so the hover
           * reference has the badge's real size — positioning a child instead
           * leaves the reference zero-sized and the tooltip flickers. The
           * tooltip is a hover enhancement: the badge's own label text is
           * its accessible name, so the state never depends on the tooltip
           * (which renders nothing on touch-only devices). */
          <Tooltip
            tooltip={
              <span className="flex flex-col gap-1 text-start">
                <span className="dial-small-semi-text">
                  {limitedAccessTooltipTitle}
                </span>
                <span className="dial-small-text">
                  {limitedAccessTooltipDescription}
                </span>
              </span>
            }
          >
            <Badge
              label={limitedAccessLabel}
              variant={BadgeVariant.Filled}
              color={BadgeColor.Red}
            />
          </Tooltip>
        ) : (
          action
        )}
      </div>
    </div>
  );
};
