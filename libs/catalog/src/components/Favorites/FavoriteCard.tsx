import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialIcon, ElementSize } from '@epam/ai-dial-ui-kit';
import { IconHistory } from '@tabler/icons-react';
import { FC, KeyboardEvent, MouseEvent, useCallback, useState } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import { EntityBadge } from '../EntityBadge/EntityBadge';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import styles from './Favorites.module.scss';

/** Props for FavoriteCard. */
export interface FavoriteCardProps {
  /** The favorite item to display. */
  item: CatalogItem;
  /** Initial starred state. Default: true (items in favorites are starred by default). */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** Called when the card body is clicked. Opens the details panel. */
  onClick?: (item: CatalogItem) => void;
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
  onClick,
  nameClassName,
  versionClassName,
  lastUsedClassName = 'dial-caption-text',
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleToggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    if (!next) {
      // Keep the card in the DOM while it plays its exit animation;
      // onAnimationEnd on the div fires onToggle once the animation finishes.
      setIsLeaving(true);
    } else {
      onToggle?.(item.id, next);
    }
  };

  const handleClick = onClick && !isLeaving ? () => onClick(item) : undefined;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!onClick || isLeaving) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(item);
      }
    },
    [onClick, item, isLeaving],
  );

  return (
    <div
      data-card-id={item.id}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={mergeClasses(
        'box-border flex min-w-0 cursor-pointer flex-col gap-1 rounded-[6px] p-[13px] pb-[9px]',
        styles.card,
        isLeaving && styles.cardLeaving,
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAnimationEnd={
        isLeaving
          ? (e) => {
              if (e.currentTarget === e.target) onToggle?.(item.id, false);
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2">
        <DeploymentIcon src={item.iconUrl} size={48} />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <EntityBadge type={item.type} />
          <ItemHeader
            title={item.name}
            postfix={item.version}
            postfixClassName={versionClassName}
            titleClassName={nameClassName}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <DialIcon
                icon={<IconHistory size={DIAL_ICON_SIZE.SM} />}
                className={styles.historyIcon}
              />
              <span className={lastUsedClassName}>{item.lastUsed}</span>
            </div>

            <StarToggleButton
              isStarred={isStarred}
              size={ElementSize.Small}
              onClick={handleToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
