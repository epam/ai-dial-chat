import {
  DialGhostIconButton,
  DialIcon,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconHistory, IconStar, IconStarFilled } from '@tabler/icons-react';
import { FC, useState } from 'react';
import type { FavoriteItem } from '../../models/CatalogItem';
import { EntityTypeBadge } from '../EntityTypeBadge/EntityTypeBadge';
import { ProviderLogo } from '../ProviderLogo/ProviderLogo';

/** Props for FavoriteCard. */
export interface FavoriteCardProps {
  /** The favorite item to display. */
  item: FavoriteItem;
  /** Initial starred state. Default: true (items in favorites are starred by default). */
  initialIsStarred?: boolean;
  /** Called when the star button is toggled. */
  onToggle?: (id: string, isStarred: boolean) => void;
  /** CSS class for the item name. Default: 'dial-h3-text text-primary'. */
  nameClassName?: string;
  /** CSS class for the version text. Default: 'dial-tiny-text text-secondary'. */
  versionClassName?: string;
  /** CSS class for the "last used" text. Default: 'dial-caption-text text-secondary'. */
  lastUsedClassName?: string;
}

/** Compact card for the Favorites strip with hover lift and star toggle. */
export const FavoriteCard: FC<FavoriteCardProps> = ({
  item,
  initialIsStarred = true,
  onToggle,
  nameClassName = 'dial-h3-text text-primary',
  versionClassName = 'dial-tiny-text text-secondary',
  lastUsedClassName = 'dial-caption-text text-secondary',
}) => {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = () => {
    const next = !isStarred;
    setIsStarred(next);
    onToggle?.(item.id, next);
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: 6,
        border: '1px solid var(--stroke-secondary, #242C42)',
        padding: '13px 13px 9px',
        boxSizing: 'border-box',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: isHovered
          ? 'var(--controls-bg-accent-tertiary-alpha-active, #A972FF5C)'
          : 'var(--bg-accent-tertiary-alpha, #A972FF2E)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'transform 150ms ease-out, background 150ms ease-out',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <ProviderLogo color={item.logoColor} initial={item.logoInitial} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <EntityTypeBadge type={item.type} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span
              className={nameClassName}
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.name}
            </span>
            <span className={versionClassName}>{item.version}</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: -3,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <DialIcon
                icon={<IconHistory size={16} />}
                className="text-secondary"
              />
              <span className={lastUsedClassName}>{item.lastUsed}</span>
            </div>
            <DialGhostIconButton
              size={ElementSize.Small}
              icon={
                isStarred ? (
                  <IconStarFilled
                    size={16}
                    style={{ color: 'var(--text-warning-icon, #EEC840)' }}
                  />
                ) : (
                  <IconStar size={16} />
                )
              }
              onClick={handleToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
