import {
  buildCssVars,
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  DialTag,
} from '@epam/ai-dial-ui-kit';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { CatalogCardProps } from '../../models/CatalogCardProps';
import { EntityTypeBadge } from '../EntityTypeBadge/EntityTypeBadge';
import { FolderPath } from '../FolderPath/FolderPath';
import { PricingTag } from '../PricingTag/PricingTag';
import styles from './CatalogCardGrid.module.scss';

/** Card for the Browse grid with highlighted search text and optional featured styling. */
export const CatalogCard: FC<CatalogCardProps> = ({
  item,
  query = '',
  initialIsStarred = false,
  onToggle,
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

  const handleToggle = () => {
    const next = !isStarred;
    setIsStarred(next);
    onToggle?.(item.id, next);
  };

  return (
    <div
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
          <EntityTypeBadge type={item.type} />
          <div className="mt-0.5 flex items-start gap-1">
            <span className={mergeClasses(nameClassName, styles.name)}>
              <Highlight text={item.name} query={query} />
            </span>
            <span className={mergeClasses(versionClassName, styles.version)}>
              {item.version}
            </span>
          </div>
        </div>
      </div>

      <p
        className={mergeClasses(
          'm-0 overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]',
          descriptionClassName,
          styles.description,
        )}
      >
        <Highlight text={item.description} query={query} />
      </p>

      <div className="flex flex-wrap gap-1.5">
        {item.pricing.map((p) => (
          <PricingTag key={p} label={p} />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <FolderPath segments={item.folder} />
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
          onClick={handleToggle}
        />
      </div>
    </div>
  );
};
