import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC, ReactNode } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import { EntityTypeLabel } from '../EntityTypeLabel/EntityTypeLabel';
import { FeaturedChip } from '../FeaturedChip/FeaturedChip';
import { ItemHeader } from '../ItemHeader/ItemHeader';

/** Props for EntityHeader. */
export interface EntityHeaderProps {
  /** The favorite item to display. */
  item: CatalogItem;
  /** Typography CSS class for the item name. Falls back to `ItemHeader`'s own default when omitted. */
  nameClassName?: string;
  /** CSS class for the entity type label. Default: 'dial-caption-lead-semi-text'. */
  typeClassName?: string;
  /** CSS class applied to the icon badge, e.g. to set border-radius. Default: 'rounded-[14px]'. */
  iconBadgeClassName?: string;
  /** Typography CSS class for the version text. Falls back to `ItemHeader`'s own default when omitted. */
  versionClassName?: string;
  /** Whether to show `item.version` next to the title. Default: true. */
  showVersion?: boolean;
  /** Label for the featured tag shown when item.isFeatured is true. Default: 'Featured'. */
  featuredLabel?: string;
  /** Whether to render the featured tag. Default: true. */
  hasFeaturedTag?: boolean;
  /** Size of the deployment icon. Default: 48. */
  iconSize?: number;
  /** Search query string; when provided, matching text in the title is highlighted. */
  query?: string;
  /** Content pinned to the bottom of the text column via `mt-auto`, aligning its baseline with the avatar bottom. When provided, the column stretches to fill the icon height exactly. */
  footer?: ReactNode;
  /** CSS class for the featured chip. */
  featuredChipClassName?: string;
}

/** Reusable entity identity block: deployment icon, type label, name, version, and optional featured chip. */
export const EntityHeader: FC<EntityHeaderProps> = ({
  item,
  nameClassName,
  versionClassName,
  showVersion = true,
  typeClassName = 'dial-caption-lead-semi-text',
  iconBadgeClassName = 'rounded-[14px]',
  featuredChipClassName,
  featuredLabel = 'Featured',
  hasFeaturedTag = true,
  iconSize = 48,
  query,
  footer,
}) => {
  return (
    <div className="flex items-start gap-2">
      <DeploymentIcon
        src={item.iconUrl}
        size={iconSize}
        initialsName={item.name}
        styles={{ badgeClassName: iconBadgeClassName }}
      />

      <div
        className={mergeClasses(
          'flex min-w-0 flex-1 flex-col gap-1',
          footer != null && 'self-stretch',
        )}
      >
        <div className="relative flex flex-row items-center justify-between">
          <EntityTypeLabel type={item.type} className={typeClassName} />
          {hasFeaturedTag && item.isFeatured && (
            <div className="absolute end-0 top-[-6px]">
              <FeaturedChip
                type={item.type}
                label={featuredLabel}
                className={featuredChipClassName}
              />
            </div>
          )}
        </div>
        <ItemHeader
          title={item.name}
          postfix={showVersion ? item.version : undefined}
          postfixClassName={versionClassName}
          titleClassName={nameClassName}
          query={query}
        />
        {footer != null && <div className="mt-auto pt-1">{footer}</div>}
      </div>
    </div>
  );
};
