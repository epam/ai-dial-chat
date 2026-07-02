import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import {
  DeploymentIcon,
  Highlight,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  GhostButton,
  GhostIconButton,
  GradientCheckIcon,
  SearchBar,
} from '@epam/ai-dial-kit';
import { DialEllipsisTooltip, DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconStarFilled } from '@tabler/icons-react';
import { type FC, type KeyboardEvent, useMemo, useState } from 'react';
import styles from './ModelPickerPanel.module.scss';

/** Localizable string labels for `ModelPickerPanel`. */
export interface ModelPickerLabels {
  /** Placeholder for the search input. Default: `'Search models, agents…'`. */
  searchPlaceholder?: string;
  /** Accessible label for the search input. Default: `'Search models and agents'`. */
  searchAriaLabel?: string;
  /** Hint shown when Favorites is empty. Default: `'Star a model or agent to pin it here.'`. */
  emptyHint?: string;
  /** Label for the footer action button. Default: `'Browse'`. */
  browseCatalogLabel?: string;
  /** Accessible label for the remove-from-favorites button. Default: `'Remove from favorites'`. */
  removeFromFavoritesLabel?: string;
}

interface Props {
  /** Starred catalog items to display in the Favorites list. */
  favorites: CatalogItem[];
  /** ID of the currently selected deployment. */
  selectedId?: string | null;
  /** Called with the selected item's id. The panel closes itself after calling this. */
  onSelect: (id: string) => void;
  /** Called when the star button is clicked to remove an item from favorites. */
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  /** Called when the user clicks "Browse". */
  onBrowseCatalog?: () => void;
  /** Called by the panel to request that the parent popover close. */
  onClose: () => void;
  /** Optional i18n string overrides. */
  labels?: ModelPickerLabels;
}

export const ModelPickerPanel: FC<Props> = ({
  favorites,
  selectedId,
  onSelect,
  onToggleFavorite,
  onBrowseCatalog,
  onClose,
  labels = {},
}) => {
  const {
    searchPlaceholder = 'Search models, agents…',
    searchAriaLabel = 'Search models and agents',
    emptyHint = 'Star a model or agent to pin it here.',
    browseCatalogLabel = 'Browse',
    removeFromFavoritesLabel = 'Remove from favorites',
  } = labels;

  const [query, setQuery] = useState('');

  const talkableItems = useMemo(
    () =>
      favorites.filter(
        (f) =>
          f.type === CatalogEntityType.Model ||
          f.type === CatalogEntityType.Agent,
      ),
    [favorites],
  );

  const filteredFavorites = useMemo(() => {
    if (!query.trim()) return talkableItems;
    const q = query.toLowerCase();
    return talkableItems.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.topics.some((t) => t.toLowerCase().includes(q)) ||
        f.folder.some((s) => s.toLowerCase().includes(q)),
    );
  }, [talkableItems, query]);

  const handleSelect = (item: CatalogItem) => {
    onSelect(item.id);
    onClose();
  };

  const handleItemKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    item: CatalogItem,
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(item);
    }
  };

  const handleBrowse = () => {
    onBrowseCatalog?.();
    onClose();
  };

  return (
    <div className="flex min-w-[240px] flex-col">
      {/* Sticky search header */}
      <div className="sticky top-0 z-10 bg-layer-0 pb-1 ps-2 pt-2">
        <SearchBar
          value={query}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
          onChange={setQuery}
          containerClassName={mergeClasses(
            styles.searchFocus,
            '!bg-transparent !border-transparent hover:!border-transparent !rounded-full !shadow-none',
          )}
        />
      </div>

      {filteredFavorites.length > 0 ? (
        <ul className="max-h-72 overflow-y-auto py-1">
          {filteredFavorites.map((item) => (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={0}
                className={mergeClasses(
                  'flex cursor-pointer items-center gap-2 px-2 py-1.5',
                  'hover:bg-secondary transition-colors',
                  item.id === selectedId && 'bg-accent-primary-alpha',
                )}
                onClick={() => handleSelect(item)}
                onKeyDown={(e) => handleItemKeyDown(e, item)}
              >
                <DeploymentIcon
                  src={item.iconUrl}
                  size={DIAL_ICON_SIZE.MD}
                  initialsName={item.name}
                />
                <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  {query.trim() ? (
                    <span className="truncate">
                      <Highlight text={item.name} query={query} />
                    </span>
                  ) : (
                    <DialEllipsisTooltip text={item.name} />
                  )}
                  {item.version != null && (
                    <span className="dial-tiny-text min-w-0 truncate text-secondary">
                      {item.version}
                    </span>
                  )}
                </div>
                {item.id === selectedId && (
                  <span className="flex-shrink-0">
                    <GradientCheckIcon gradientId="mp-check-grad" />
                  </span>
                )}
                <GhostIconButton
                  icon={
                    <IconStarFilled
                      size={DIAL_ICON_SIZE.SM}
                      className="text-[var(--text-warning-icon,#eec840)]"
                    />
                  }
                  aria-label={removeFromFavoritesLabel}
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(item.id, false);
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dial-small-text px-4 py-4 text-center text-secondary">
          {emptyHint}
        </p>
      )}

      <div className="border-t border-secondary px-2 py-1">
        <GhostButton
          label={browseCatalogLabel}
          className="w-full justify-center"
          onClick={handleBrowse}
        />
      </div>
    </div>
  );
};
