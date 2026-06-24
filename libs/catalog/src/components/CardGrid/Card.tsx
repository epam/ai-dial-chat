import {
  buildCssVars,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { CardProps } from '../../models/card-props';
import { EntityHeader } from '../EntityHeader/EntityHeader';
import { FolderPath } from '../FolderPath/FolderPath';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { TopicsLine } from '../TopicTag/TopicTag';
import styles from './CardGrid.module.scss';

/** Card for the Browse grid with highlighted search text and optional featured styling. */
export const Card: FC<CardProps> = ({
  item,
  query = '',
  initialIsStarred = false,
  onToggle,
  onClick,
  styles: cardStyles,
  featuredLabel = 'Featured',
  className,
}) => {
  const { colors, typography } = cardStyles ?? {};
  const nameClassName = typography?.nameClassName ?? 'dial-h3-text';
  const versionClassName = typography?.versionClassName ?? 'dial-tiny-text';
  const descriptionClassName =
    typography?.descriptionClassName ?? 'dial-small-text';

  const cssVars = buildCssVars({
    '--cat-card-bg': colors?.background,
    '--cat-card-hover-bg': colors?.hoverBackground,
    '--cat-card-border': colors?.border,
    '--cat-card-featured-glow': colors?.featuredGlow,
    '--cat-card-featured-bar': colors?.featuredBar,
    '--cat-card-text-primary': colors?.textPrimary,
    '--cat-card-text-secondary': colors?.textSecondary,
    '--cat-card-star-filled': colors?.starFilled,
  });

  const [isStarred, setIsStarred] = useState(initialIsStarred ?? false);

  // Sync when the parent updates the starred state externally (e.g. un-starring
  // from the Favorites strip should reflect back on the Browse card).
  useEffect(() => {
    setIsStarred(initialIsStarred ?? false);
  }, [initialIsStarred]);

  const handleToggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    onToggle?.(item.id, next);
  };

  const handleClick = onClick ? () => onClick(item) : undefined;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (!onClick) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(item);
      }
    },
    [onClick, item],
  );

  return (
    <div
      {...(onClick
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: handleClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      className={mergeClasses(
        'relative box-border flex cursor-pointer flex-col gap-2 rounded-[6px] border p-4 transition-transform duration-150 ease-out hover:-translate-y-[4px]',
        styles.card,
        item.isFeatured ? styles.featuredCard : undefined,
        className,
      )}
      style={cssVars}
    >
      <EntityHeader
        item={item}
        featuredLabel={featuredLabel}
        versionClassName={versionClassName}
        nameClassName={nameClassName}
      />

      <p
        className={mergeClasses(
          'line-clamp-2',
          descriptionClassName,
          styles.description,
        )}
      >
        <Highlight text={item.description} query={query} />
      </p>

      <div className="mt-auto flex flex-col gap-4">
        <TopicsLine topics={item.topics} />

        <div
          className={mergeClasses(
            '-me-[10px] flex items-center justify-between border-t pt-2',
            styles.cardFooter,
          )}
        >
          <FolderPath segments={item.folder} />
          <StarToggleButton isStarred={isStarred} onClick={handleToggle} />
        </div>
      </div>
    </div>
  );
};
