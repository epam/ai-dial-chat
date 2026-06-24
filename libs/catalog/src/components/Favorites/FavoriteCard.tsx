import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialIcon, ElementSize } from '@epam/ai-dial-ui-kit';
import { IconHistory } from '@tabler/icons-react';
import { FC, MouseEvent, useCallback, useState } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import { EntityHeader } from '../EntityHeader/EntityHeader';
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
  /** Label for the featured tag shown when item.isFeatured is true. Default: 'Featured'. */
  featuredLabel?: string;
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
  featuredLabel = 'Featured',
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

  const handleClick = useCallback(() => {
    if (!isLeaving) onClick?.(item);
  }, [isLeaving, item, onClick]);

  return (
    <button
      type="button"
      data-card-id={item.id}
      className={mergeClasses(
        'box-border flex min-w-0 cursor-pointer flex-col gap-1 rounded-[6px] p-[13px] pb-[9px]',
        'w-full border-0 bg-transparent text-start',
        styles.card,
        isLeaving && styles.cardLeaving,
      )}
      onClick={onClick ? handleClick : undefined}
      onAnimationEnd={
        isLeaving
          ? (e) => {
              if (e.currentTarget === e.target) onToggle?.(item.id, false);
            }
          : undefined
      }
    >
      <EntityHeader
        item={item}
        featuredLabel={featuredLabel}
        nameClassName={nameClassName}
        versionClassName={versionClassName}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 pl-[50px]">
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
    </button>
  );
};
