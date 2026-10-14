import { InitialsAvatar, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Tooltip } from '@epam/ai-dial-ui-kit';
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

/** One service row of the Extensions table: an avatar with an optional corner warning badge, the service name, the description, and the host-supplied trailing action. */
export const ExtensionServiceRow: FC<ExtensionServiceRowProps> = ({
  row,
  typography,
}) => {
  const {
    nameClassName = 'dial-small-semi-text',
    descriptionClassName = 'dial-small-text',
  } = typography;

  const { displayName, description, isWarningVisible, authorizeLabel, action } =
    row;

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
            textClassName="text-lg"
          />
          {isWarningVisible && (
            /* The badge is informational, not an affordance: the plain warning
             * glyph overhanging the avatar's bottom-end corner by 10px, with
             * its localized tooltip. The position sits on the tooltip's own
             * trigger so the hover reference has the glyph's real size —
             * positioning a child instead leaves the reference zero-sized and
             * the tooltip flickers. The glyph carries its own accessible name
             * (the svg is aria-hidden) because the span trigger is not
             * focusable — so the tooltip text also reaches assistive tech
             * through the icon itself. */
            <Tooltip
              tooltip={authorizeLabel}
              triggerClassName={mergeClasses(
                'absolute bottom-[-3px] end-[-10px] flex',
                styles.warningBadge,
              )}
            >
              <span role="img" aria-label={authorizeLabel}>
                <IconAlertTriangleFilled size={DIAL_ICON_SIZE.MD} aria-hidden />
              </span>
            </Tooltip>
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
            'min-w-0 break-words',
            styles.description,
          )}
        >
          {description}
        </span>
      </div>
      <div role="cell" className="flex items-center justify-end">
        {action}
      </div>
    </div>
  );
};
