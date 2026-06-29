import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { ElementSize } from '@epam/ai-dial-ui-kit';
import { FC, KeyboardEvent, MouseEvent, useCallback, useState } from 'react';
import { ENTITY_TYPE_COLOR } from '../../constants/entity-colors';
import { CatalogItem } from '../../models/catalog-item';
import { AppIdentity } from '../AppIdentity/AppIdentity';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import styles from './Favorites.module.scss';

/** Props for FavoriteCard. */
export interface FavoriteCardProps {
  /** The favorite item to display. */
  item: CatalogItem;
  /** Initial starred state. Default: true — items in favorites are starred by default. */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** Called when the card body is clicked. */
  onClick?: (item: CatalogItem) => void;
  /** CSS class for the entity name. Default: 'dial-body-semi-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version string. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** CSS class for the last-used text. Default: 'dial-tiny-text text-secondary'. */
  lastUsedClassName?: string;
  /** Search query string; matching text in the name is highlighted when provided. */
  query?: string;
}

/** Compact favorite card: logo + type + name + version + last-used, star aligned right. */
export const FavoriteCard: FC<FavoriteCardProps> = ({
  item,
  initialIsStarred = true,
  onToggle,
  onClick,
  nameClassName,
  versionClassName,
  lastUsedClassName,
  query,
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleToggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    if (!next) {
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
    <article
      data-card-id={item.id}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={item.name}
      className={mergeClasses(
        'box-border flex min-w-0 cursor-pointer items-start gap-1',
        'rounded-[16px] border px-4 py-3 text-start',
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
      <AppIdentity
        icon={item.iconUrl}
        type={item.type}
        name={item.name}
        version={item.version}
        lastUsed={item.lastUsed}
        size="lg"
        query={query}
        className="min-w-0 flex-1"
        typeColor={ENTITY_TYPE_COLOR[item.type]}
        nameClassName={nameClassName}
        versionClassName={versionClassName}
        lastUsedClassName={lastUsedClassName}
      />
      <StarToggleButton
        isStarred={isStarred}
        size={ElementSize.Small}
        onClick={handleToggle}
        ariaLabel={isStarred ? 'Remove from favorites' : 'Add to favorites'}
        className="self-end"
      />
    </article>
  );
};
