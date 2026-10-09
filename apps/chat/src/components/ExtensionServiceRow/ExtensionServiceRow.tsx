import { InitialsAvatar, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, Tooltip } from '@epam/ai-dial-ui-kit';
import { IconAlertTriangleFilled } from '@tabler/icons-react';
import { memo, type FC, type ReactNode } from 'react';
import styles from './ExtensionServiceRow.module.scss';

/* Grid template shared by the table's header row and every service row so the
 * three columns stay aligned on desktop (mirrors MODEL_LIMITS_GRID_COLUMNS).
 * The action track is bounded rather than `auto` so it resolves to the same
 * width in the header (visually empty) as in the action rows — otherwise the
 * `fr` columns ahead of it get different free space per row and the header
 * text drifts off the cells it labels. */
export const EXTENSIONS_GRID_COLUMNS =
  'desktop:grid-cols-[minmax(12rem,1.25fr)_minmax(0,1fr)_minmax(8rem,10rem)]';

const AVATAR_SIZE = 40;

interface Props {
  /** Service display name shown beside the avatar and used for its initials. */
  displayName: string;
  /** Localized service description shown in the Description cell. */
  description: string;
  /** Whether the disconnected-state warning badge renders on the avatar's corner. */
  isWarningVisible: boolean;
  /** Accessible name and tooltip text of the warning badge. */
  authorizeLabel: string;
  /** The row's trailing action (Log in / Log out), owned by the host tab. */
  action: ReactNode;
}

/**
 * One extension-service row of the Settings Extensions table: a square avatar
 * with an optional corner warning badge, the service name, the service
 * description, and the host-supplied trailing action.
 */
const ExtensionServiceRow: FC<Props> = ({
  displayName,
  description,
  isWarningVisible,
  authorizeLabel,
  action,
}) => (
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
          textClassName="!text-lg"
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
            triggerClassName="absolute bottom-[-3px] end-[-10px] flex text-warning-icon"
          >
            <span role="img" aria-label={authorizeLabel}>
              <IconAlertTriangleFilled size={DIAL_ICON_SIZE.MD} aria-hidden />
            </span>
          </Tooltip>
        )}
      </div>
      <span className="dial-small-semi-text min-w-0 flex-1 truncate text-primary">
        {displayName}
      </span>
    </div>
    <div role="cell" className="flex min-w-0 items-center">
      <span className="dial-small-text min-w-0 break-words text-secondary">
        {description}
      </span>
    </div>
    <div role="cell" className="flex items-center justify-end">
      {action}
    </div>
  </div>
);

export default memo(ExtensionServiceRow);
