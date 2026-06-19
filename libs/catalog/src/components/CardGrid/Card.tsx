import {
  buildCssVars,
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import { FC, KeyboardEvent, MouseEvent, useCallback, useState } from 'react';
import type { CardProps } from '../../models/card-props';
import { EntityBadge } from '../EntityBadge/EntityBadge';
import { FolderPath } from '../FolderPath/FolderPath';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import { StarToggleButton } from '../StarToggleButton/StarToggleButton';
import { TopicTag } from '../TopicTag/TopicTag';
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

  const [isStarred, setIsStarred] = useState(initialIsStarred);

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
        'relative box-border flex cursor-pointer flex-col gap-2.5 rounded-[6px] border p-[17px] transition-transform duration-150 ease-out hover:-translate-y-[3px]',
        styles.card,
        item.isFeatured ? styles.featuredCard : undefined,
      )}
      style={cssVars}
    >
      {item.isFeatured && (
        <>
          <div
            className={mergeClasses(
              'absolute end-[2px] start-[2px] top-0 h-0.5 rounded-t-[6px]',
              styles.featuredTopBar,
            )}
          />
          <div className="absolute end-[17px] top-[17px]">
            <DialTag
              label={featuredLabel}
              className={mergeClasses('px-[6px]', styles.featuredTag)}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <DeploymentIcon src={item.iconUrl} size={48} />
        <div className="min-w-0 flex-1">
          <EntityBadge type={item.type} />
          <ItemHeader
            title={item.name}
            query={query}
            postfix={item.version}
            postfixClassName={versionClassName}
            titleClassName={nameClassName}
            className="mt-0.5 flex items-start gap-1"
          />
        </div>
      </div>

      <p className={mergeClasses(descriptionClassName, styles.description)}>
        <Highlight text={item.description} query={query} />
      </p>

      <div className="mt-auto">
        <div className="flex flex-wrap gap-1.5">
          {item.topics.map((p) => (
            <TopicTag key={p} label={p} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-secondary pt-2">
          <FolderPath segments={item.folder} />
          <StarToggleButton isStarred={isStarred} onClick={handleToggle} />
        </div>
      </div>
    </div>
  );
};
