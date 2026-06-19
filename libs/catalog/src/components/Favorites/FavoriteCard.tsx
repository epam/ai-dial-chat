import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  DialIcon,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconHistory, IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { FavoriteItem } from '../../models/catalog-item';
import { EntityBadge } from '../EntityBadge/EntityBadge';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import styles from './Favorites.module.scss';

/** Props for FavoriteCard. */
export interface FavoriteCardProps {
  /** The favorite item to display. */
  item: FavoriteItem;
  /** Initial starred state. Default: true (items in favorites are starred by default). */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** CSS class for the item name. Default: 'dial-h3-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version text. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** CSS class for the "last used" text. Default: 'dial-caption-text text-secondary'. */
  lastUsedClassName?: string;
}

/** Compact card for the Favorites strip with hover lift and star toggle. */
export const FavoriteCard: FC<FavoriteCardProps> = ({
  item,
  initialIsStarred = true,
  onToggle,
  nameClassName = 'dial-h3-text text-primary',
  versionClassName = 'dial-tiny-text text-secondary',
  lastUsedClassName = 'dial-caption-text text-secondary',
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  const handleToggle = () => {
    const next = !isStarred;
    setIsStarred(next);
    onToggle?.(item.id, next);
  };

  return (
    <div
      className={mergeClasses(
        'box-border flex min-w-0 cursor-pointer flex-col gap-1 rounded-[6px] p-[13px] pb-[9px]',
        styles.card,
      )}
    >
      <div className="flex items-start gap-2">
        <DeploymentIcon src={item.iconUrl} size={48} />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <EntityBadge type={item.type} />
          <ItemHeader
            title={item.name}
            count={item.version}
            countClassName={versionClassName}
            titleClassName={nameClassName}
          />

          <div className="-mt-[3px] flex items-center justify-between">
            <div className="flex items-center gap-1">
              <DialIcon
                icon={<IconHistory size={DIAL_ICON_SIZE.SM} />}
                className="text-secondary"
              />
              <span className={lastUsedClassName}>{item.lastUsed}</span>
            </div>
            <DialGhostIconButton
              size={ElementSize.Small}
              icon={
                isStarred ? (
                  <IconStarFilled
                    size={DIAL_ICON_SIZE.SM}
                    className={styles.starFilledIcon}
                  />
                ) : (
                  <IconStar size={DIAL_ICON_SIZE.SM} />
                )
              }
              onClick={handleToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
