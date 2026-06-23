import {
  buildCssVars,
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import { DialTag } from '@epam/ai-dial-ui-kit';
import {
  FC,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  const [visibleCount, setVisibleCount] = useState(item.topics.length);
  const topicsRef = useRef<HTMLDivElement>(null);

  const topicsKey = item.topics.join('\0');
  useLayoutEffect(() => {
    const container = topicsRef.current;
    if (!container || item.topics.length === 0) {
      setVisibleCount(item.topics.length);
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return;

    const firstTop = children[0].offsetTop;
    const rowHeight = children[0].offsetHeight;
    const limitTop = firstTop + rowHeight * 2;

    let cutoff = children.length;
    for (let i = 0; i < children.length; i++) {
      if (children[i].offsetTop >= limitTop) {
        cutoff = i;
        break;
      }
    }

    // If there is overflow, reduce by one to leave room for the "+N" badge
    setVisibleCount(
      cutoff < children.length ? Math.max(0, cutoff - 1) : children.length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsKey, 2]);

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

  const overflow = item.topics.length - visibleCount;

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
        className,
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

      <p
        className={mergeClasses(
          'line-clamp-3',
          descriptionClassName,
          styles.description,
        )}
      >
        <Highlight text={item.description} query={query} />
      </p>

      <div className="mt-auto">
        <div ref={topicsRef} className="flex flex-wrap gap-1.5">
          {item.topics.slice(0, visibleCount).map((p) => (
            <TopicTag key={p} label={p} />
          ))}
          {overflow > 0 && <TopicTag label={`+${overflow}`} />}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-secondary pt-2">
          <FolderPath segments={item.folder} />
          <StarToggleButton isStarred={isStarred} onClick={handleToggle} />
        </div>
      </div>
    </div>
  );
};
