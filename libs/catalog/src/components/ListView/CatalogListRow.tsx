import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, type KeyboardEvent, type MouseEvent, useState } from 'react';
import type { CatalogItem } from '../../models/CatalogItem';
import type { CatalogListViewTypography } from '../../models/CatalogListViewProps';
import { EntityTypeBadge } from '../EntityTypeBadge/EntityTypeBadge';
import { FeaturedTag } from '../FeaturedTag/FeaturedTag';
import { FolderPath } from '../FolderPath/FolderPath';
import { Highlight } from '../Highlight/Highlight';
import { PricingTag } from '../PricingTag/PricingTag';
import { ProviderLogo } from '../ProviderLogo/ProviderLogo';
import styles from './CatalogListView.module.scss';

/**
 * CSS grid column template shared by the header row and every data row
 * so that columns stay perfectly aligned.
 */
export const LIST_COL_TEMPLATE =
  '48px minmax(0,2fr) 100px minmax(0,1fr) minmax(0,1fr) 32px';

/** Props for CatalogListRow. */
export interface CatalogListRowProps {
  /** The catalog item to render. */
  item: CatalogItem;
  /** Active search query forwarded to Highlight. */
  query: string;
  /** Whether this row uses the odd-indexed background. */
  isOdd: boolean;
  /** Typography overrides propagated from CatalogListView. */
  typography?: CatalogListViewTypography;
  /** Called when the star button is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Called when the row body is clicked. */
  onClick?: (item: CatalogItem) => void;
}

/** Single row inside the catalog list table. */
export const CatalogListRow: FC<CatalogListRowProps> = ({
  item,
  query,
  isOdd,
  typography,
  onToggleFavorite,
  onClick,
}) => {
  const nameClassName = typography?.nameClassName ?? 'dial-h3-text';
  const versionClassName = typography?.versionClassName ?? 'dial-tiny-text';
  const descriptionClassName =
    typography?.descriptionClassName ?? 'dial-small-text';

  const [isStarred, setIsStarred] = useState(item.isStarred ?? false);

  const handleStarToggle = (e: MouseEvent) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    onToggleFavorite?.(item.id, next);
  };

  const handleClick = onClick ? () => onClick(item) : undefined;

  const handleKeyDown = onClick
    ? (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }
    : undefined;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      role={onClick ? 'button' : 'row'}
      tabIndex={onClick ? 0 : undefined}
      className={mergeClasses(
        'grid cursor-pointer items-center gap-x-4 border-b px-4 py-3',
        isOdd ? styles.rowOdd : styles.rowEven,
        styles.row,
      )}
      style={{ gridTemplateColumns: LIST_COL_TEMPLATE }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Provider icon */}
      <ProviderLogo color={item.logoColor} initial={item.logoInitial} />

      {/* Name, version, featured badge, description */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span
            className={mergeClasses('truncate', nameClassName, styles.nameText)}
          >
            <Highlight text={item.name} query={query} />
          </span>
          {item.version && (
            <span
              className={mergeClasses(
                'shrink-0',
                versionClassName,
                styles.secondaryText,
              )}
            >
              {item.version}
            </span>
          )}
          {item.isFeatured && <FeaturedTag className="shrink-0" />}
        </div>
        <p
          className={mergeClasses(
            'm-0 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:1] [display:-webkit-box]',
            descriptionClassName,
            styles.secondaryText,
          )}
        >
          <Highlight text={item.description} query={query} />
        </p>
      </div>

      {/* Entity type badge */}
      <EntityTypeBadge type={item.type} />

      {/* Folder breadcrumb */}
      <FolderPath segments={item.folder} />

      {/* Pricing tags */}
      <div className="flex flex-wrap gap-1">
        {item.pricing.map((p) => (
          <PricingTag key={p} label={p} />
        ))}
      </div>

      {/* Star toggle */}
      <DialGhostIconButton
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
        onClick={handleStarToggle}
      />
    </div>
  );
};
