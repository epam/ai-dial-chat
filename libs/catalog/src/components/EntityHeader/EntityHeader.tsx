import { DeploymentIcon } from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import { EntityBadge } from '../EntityBadge/EntityBadge';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import styles from './EntityHeader.module.scss';

/** Props for EntityHeader. */
export interface EntityHeaderProps {
  /** The favorite item to display. */
  item: CatalogItem;
  /** CSS class for the item name. Default: 'dial-h3-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version text. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** Label for the featured tag shown when item.isFeatured is true. Default: 'Featured'. */
  featuredLabel?: string;
  /** Size of the deployment icon. Default: 48. */
  iconSize?: number;
}

/** Compact card for the Favorites strip with hover lift and star toggle. */
export const EntityHeader: FC<EntityHeaderProps> = ({
  item,
  nameClassName,
  versionClassName,
  featuredLabel = 'Featured',
  iconSize = 48,
}) => {
  return (
    <div className="flex items-start gap-2">
      <DeploymentIcon src={item.iconUrl} size={iconSize} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="relative flex flex-row items-center justify-between">
          <EntityBadge type={item.type} />
          {item.isFeatured && (
            <div className="absolute right-0 top-[-6px]">
              <DialTag label={featuredLabel} className={styles.featuredTag} />
            </div>
          )}
        </div>
        <ItemHeader
          title={item.name}
          postfix={item.version}
          postfixClassName={versionClassName}
          titleClassName={nameClassName}
        />
      </div>
    </div>
  );
};
