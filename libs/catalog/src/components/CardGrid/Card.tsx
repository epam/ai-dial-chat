import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialTag, ElementSize } from '@epam/ai-dial-ui-kit';
import React, { FC, KeyboardEvent, MouseEvent, useCallback, useState } from 'react';
import { ENTITY_TYPE_COLOR, ENTITY_TYPE_SHADOW } from '../../constants/entity-colors';
import type { CardProps } from '../../models/card-props';
import { AppIdentity } from '../AppIdentity/AppIdentity';
import { FolderPath } from '../FolderPath/FolderPath';
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
  className,
  styles: cardStyles,
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);

  const descriptionClassName =
    cardStyles?.typography?.descriptionClassName ??
    'dial-small-text text-secondary';
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
    <article
      {...(onClick
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: handleClick,
            onKeyDown: handleKeyDown,
          }
        : {})}
      aria-label={item.name}
      style={
        item.isFeatured
          ? ({
              '--entity-color': ENTITY_TYPE_COLOR[item.type],
              '--entity-shadow': ENTITY_TYPE_SHADOW[item.type],
            } as React.CSSProperties)
          : undefined
      }
      className={mergeClasses(
        'relative box-border flex cursor-pointer flex-col gap-[14px]',
        'rounded-[16px] border p-[18px]',
        styles.card,
        item.isFeatured ? styles.featuredCard : undefined,
        className,
      )}
    >
      {item.isFeatured && (
        <DialTag
          label={featuredLabel}
          className={mergeClasses(
            'absolute end-[18px] top-0 -translate-y-1/2',
            'dial-tiny-semi-text uppercase tracking-[0.06em]',
            styles.featuredChip,
          )}
        />
      )}

      {/* Top row: AppIdentity */}
      <AppIdentity
        icon={item.iconUrl}
        type={item.type}
        name={item.name}
        version={item.version}
        size="sm"
        query={query}
        className="min-w-0 flex-1"
        typeColor={ENTITY_TYPE_COLOR[item.type]}
      />

      {/* Description */}
      <p
        className={mergeClasses(
          descriptionClassName,
          'line-clamp-2',
          styles.description,
        )}
      >
        {item.description}
      </p>

      {/* Topic chips */}
      <TopicsLine topics={item.topics} />

      {/* Breadcrumbs + star — pinned to card bottom via mt-auto */}
      <div className="mt-auto border-t border-tertiary pt-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {item.folder.length > 0 && (
              <FolderPath
                segments={item.folder}
                labelClassName="dial-tiny-text"
                leafClassName="dial-tiny-semi-text"
              />
            )}
          </div>
          <StarToggleButton
            isStarred={isStarred}
            size={ElementSize.Small}
            onClick={handleStarToggle}
            ariaLabel={isStarred ? 'Remove from favorites' : 'Add to favorites'}
          />
        </div>
      </div>
    </article>
  );
};
