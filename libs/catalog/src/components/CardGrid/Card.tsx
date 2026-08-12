import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  CardShell,
  DIAL_ICON_SIZE,
  ElementSize,
  FolderPath,
} from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { CardProps } from '../../models/card-props';
import { DeploymentSize } from '../../types/deployment-icon-size';
import { AppIdentity } from '../AppIdentity/AppIdentity';
import { CredentialsBadge } from '../CredentialsBadge/CredentialsBadge';
import { FeaturedChip } from '../FeaturedChip/FeaturedChip';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { TopicsLine } from '../TopicTag/TopicTag';
import styles from './CardGrid.module.scss';

/** Browse grid card: AppIdentity header + description + topic chips + breadcrumbs + star. */
export const Card: FC<CardProps> = ({
  item,
  query = '',
  onClick,
  initialIsStarred = false,
  onToggle,
  featuredLabel = 'Featured',
  addToFavoritesAriaLabel = 'Add to favorites',
  removeFromFavoritesAriaLabel = 'Remove from favorites',
  isSelected = false,
  className,
  styles: cardStyles,
  credentialsBadgeLoggedOutLabel,
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  /*
   * Resyncs local optimistic state when the caller's `favoriteIds` reverts
   * after a failed toggle request — without this, the star stays stuck on
   * whatever the user last clicked (issue #7924).
   */
  useEffect(() => {
    setIsStarred(initialIsStarred);
  }, [item.id, initialIsStarred]);

  const descriptionClassName =
    cardStyles?.typography?.descriptionClassName ?? 'dial-small-text';
  const descriptionSizeClassName =
    cardStyles?.typography?.descriptionSizeClassName ?? 'dial-tiny-text';

  const featuredChipClassName = cardStyles?.typography?.featuredChipClassName;
  const folderLabelClassName =
    cardStyles?.typography?.folderLabelClassName ?? 'dial-tiny-text';
  const folderLeafClassName =
    cardStyles?.typography?.folderLeafClassName ?? 'dial-tiny-semi-text';

  const cssVars = buildCssVars({
    '--cg-description-text': cardStyles?.colors?.textSecondary,
    '--cg-selected-border': cardStyles?.colors?.selectedBorder,
    '--cg-selected-bg': cardStyles?.colors?.selectedBackground,
    '--cg-check-icon': cardStyles?.colors?.checkIcon,
    '--cg-footer-border': cardStyles?.colors?.footerBorder,
  });

  const handleClick = onClick ? () => onClick(item) : undefined;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!onClick) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(item);
      }
    },
    [onClick, item],
  );

  const handleStarToggle = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      const next = !isStarred;
      setIsStarred(next);
      onToggle?.(item.id, next);
    },
    [isStarred, onToggle, item.id],
  );

  return (
    <CardShell
      {...(onClick
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: handleClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      aria-label={item.name}
      style={cssVars}
      className={mergeClasses(
        'box-border cursor-pointer',
        styles.card,
        item.isFeatured ? styles.featuredCard : undefined,
        isSelected ? styles.selectedCard : undefined,
        className,
      )}
    >
      {item.isFeatured && (
        <div className="absolute end-[22px] top-0 -translate-y-1/2">
          <FeaturedChip
            label={featuredLabel}
            type={item.type}
            className={featuredChipClassName}
          />
        </div>
      )}

      {isSelected && (
        <IconCheck
          size={DIAL_ICON_SIZE.SM}
          className={mergeClasses(
            'absolute end-3 top-3 shrink-0',
            styles.checkIcon,
          )}
          aria-hidden
        />
      )}

      <AppIdentity
        icon={item.iconUrl}
        type={item.type}
        name={item.name}
        version={item.version}
        size={DeploymentSize.SM}
        query={query}
        className="min-w-0 flex-1"
        iconClassName={styles.cardIcon}
      />

      {/* Description */}
      <p
        className={mergeClasses(
          descriptionClassName,
          'line-clamp-2 min-h-[44px]',
          descriptionSizeClassName,
          styles.description,
        )}
      >
        {item.description}
      </p>

      <div className="flex min-h-[28px] items-center justify-between gap-2">
        <TopicsLine topics={item.topics} />
        <CredentialsBadge
          credentials={item.credentials}
          loggedOutLabel={credentialsBadgeLoggedOutLabel}
        />
      </div>

      <div className={mergeClasses('mt-auto border-t pt-3', styles.footer)}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {item.folder.length > 0 && (
              <FolderPath
                segments={item.folder}
                labelClassName={folderLabelClassName}
                leafClassName={folderLeafClassName}
              />
            )}
          </div>
          <StarToggleButton
            isStarred={isStarred}
            size={ElementSize.Small}
            onClick={handleStarToggle}
            ariaLabel={
              isStarred ? removeFromFavoritesAriaLabel : addToFavoritesAriaLabel
            }
            className={mergeClasses(
              styles.starBtn,
              !isStarred && styles.emptyStarHidden,
            )}
          />
        </div>
      </div>
    </CardShell>
  );
};
