import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { CardShell, DIAL_ICON_SIZE, ElementSize } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { FC, KeyboardEvent, MouseEvent, useCallback, useState } from 'react';
import { CatalogItem } from '../../models/catalog-item';
import { DeploymentSize } from '../../types/deployment-icon-size';
import { AppIdentity } from '../AppIdentity/AppIdentity';
import { CredentialsBadge } from '../CredentialsBadge/CredentialsBadge';
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
  /** Accessible label for the star button when the item is not starred. Default: `'Add to favorites'`. */
  addToFavoritesAriaLabel?: string;
  /** Accessible label for the star button when the item is already starred. Default: `'Remove from favorites'`. */
  removeFromFavoritesAriaLabel?: string;
  /** Whether this card represents the currently selected item — shows an accent border, tinted background, and a checkmark. Default: false. */
  isSelected?: boolean;
  /** Credentials-status badge label shown when signed out. Default: `'LOGGED OUT'`. */
  credentialsBadgeLoggedOutLabel?: string;
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
  addToFavoritesAriaLabel = 'Add to favorites',
  removeFromFavoritesAriaLabel = 'Remove from favorites',
  isSelected = false,
  credentialsBadgeLoggedOutLabel,
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
    <CardShell
      data-card-id={item.id}
      role={handleClick != null ? 'button' : undefined}
      tabIndex={handleClick != null ? 0 : undefined}
      aria-label={item.name}
      className={mergeClasses(
        'box-border min-w-0 cursor-pointer flex-row items-start gap-1 text-start',
        isLeaving && styles.cardLeaving,
        isSelected
          ? 'border-accent-primary !bg-accent-primary-alpha'
          : undefined,
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
      {isSelected && (
        <IconCheck
          size={DIAL_ICON_SIZE.SM}
          className="absolute end-3 top-3 shrink-0 text-accent"
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <AppIdentity
          icon={item.iconUrl}
          type={item.type}
          name={item.name}
          version={item.version}
          lastUsed={item.lastUsed}
          size={DeploymentSize.LG}
          query={query}
          className="min-w-0 self-stretch"
          nameClassName={nameClassName}
          versionClassName={versionClassName}
          lastUsedClassName={lastUsedClassName}
        />
        <CredentialsBadge
          credentials={item.credentials}
          loggedOutLabel={credentialsBadgeLoggedOutLabel}
        />
      </div>
      <StarToggleButton
        isStarred={isStarred}
        size={ElementSize.Small}
        onClick={handleToggle}
        ariaLabel={
          isStarred ? removeFromFavoritesAriaLabel : addToFavoritesAriaLabel
        }
        className="self-end"
      />
    </CardShell>
  );
};
