import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { DeploymentIcon, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchBar } from '@epam/ai-dial-kit';
import {
  DIAL_ICON_SIZE,
  GhostButton,
  GhostIconButton,
  DialEllipsisTooltip,
  Highlight,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconStar, IconStarFilled } from '@tabler/icons-react';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import styles from './DeploymentSelectorPanel.module.scss';

/** Localizable string labels for `DeploymentSelectorPanel`. */
export interface DeploymentSelectorLabels {
  /** Placeholder and accessible label for the search input. Default: `'Search models, agents…'`. */
  searchPlaceholder?: string;
  /** Heading above the favorites list. Default: `'Favorites'`. */
  favoritesLabel?: string;
  /** Hint shown when Favorites is empty. Default: `'Star a model or agent to pin it here.'`. */
  emptyHint?: string;
  /** Label for the footer action button. Default: `'Browse'`. */
  browseCatalogLabel?: string;
  /** Accessible label for the remove-from-favorites button. Default: `'Remove from favorites'`. */
  removeFromFavoritesLabel?: string;
  /** Heading above the currently-selected row when it isn't a favorite. Default: `'Currently selected'`. */
  currentlySelectedLabel?: string;
  /** Accessible label for the add-to-favorites button on the currently-selected row. Default: `'Add to favorites'`. */
  addToFavoritesLabel?: string;
}

interface Props {
  /** Starred catalog items to display in the Favorites list. */
  favorites: CatalogItem[];
  /** ID of the currently selected deployment. */
  selectedId?: string | null;
  /**
   * Full catalog item for the currently selected deployment. Pass this even
   * when the item isn't in `favorites` so the panel can surface it in a
   * dedicated "Currently selected" row above the Favorites list.
   */
  selectedItem?: CatalogItem;
  /** Called with the selected item's id. The panel closes itself after calling this. */
  onSelect: (id: string) => void;
  /** Called when the star button is clicked to add/remove an item from favorites. */
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<void> | void;
  /** Called when the user clicks "Browse". */
  onBrowseCatalog?: () => void;
  /** Called by the panel to request that the parent popover close. */
  onClose: () => void;
  /** Optional i18n string overrides. */
  labels?: DeploymentSelectorLabels;
}

const SECTION_HEADING_CLASS_NAME =
  'dial-tiny-lead-semi-text px-3 pb-0.5 pt-2 text-tertiary';

// Must match the .rowLeaving exit-animation duration in DeploymentSelectorPanel.module.scss.
const ROW_LEAVE_ANIMATION_MS = 180;

// Matches the previous max-h-72 cap on the scrollable list.
const LIST_MAX_HEIGHT_PX = 288;

const matchesQuery = (item: CatalogItem, query: string): boolean => {
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.topics.some((t) => t.toLowerCase().includes(q)) ||
    item.folder.some((s) => s.toLowerCase().includes(q))
  );
};

const DeploymentSelectorPanel: FC<Props> = ({
  favorites,
  selectedId,
  selectedItem,
  onSelect,
  onToggleFavorite,
  onBrowseCatalog,
  onClose,
  labels = {},
}) => {
  const {
    searchPlaceholder = 'Search models, agents…',
    favoritesLabel = 'Favorites',
    emptyHint = 'Star a model or agent to pin it here.',
    browseCatalogLabel = 'Browse',
    removeFromFavoritesLabel = 'Remove from favorites',
    currentlySelectedLabel = 'Currently selected',
    addToFavoritesLabel = 'Add to favorites',
  } = labels;

  const [query, setQuery] = useState('');
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const leaveTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  useEffect(() => {
    const timeouts = leaveTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

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
    return talkableItems.filter((f) => matchesQuery(f, query));
  }, [talkableItems, query]);

  const isSelectedInFavorites = talkableItems.some(
    (f) => f.id === selectedItem?.id,
  );

  const showCurrentlySelected =
    selectedItem != null &&
    !isSelectedInFavorites &&
    (!query.trim() || matchesQuery(selectedItem, query));

  /*
   * Animates the scrollable list's own height across structural changes
   * (a row moving to/from the "Currently selected" section) instead of
   * letting it snap instantly, since CSS can't transition height: auto.
   */
  const listContentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();

  useLayoutEffect(() => {
    if (listContentRef.current) {
      setListHeight(
        Math.min(listContentRef.current.scrollHeight, LIST_MAX_HEIGHT_PX),
      );
    }
  }, [filteredFavorites, showCurrentlySelected]);

  /*
   * Panel is remounted fresh each time the popover opens, so without this the
   * scrollable list always starts scrolled to the top even when the selected
   * item sits further down, making it look like the pick didn't take effect.
   */
  const selectedRowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

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

  /*
   * Plays the row's fade-out animation before actually committing the
   * favorite change, since applying it immediately would make the row
   * (and its own animation) disappear instantly.
   */
  const handleToggleFavorite = (id: string, isFavorite: boolean) => {
    setLeavingIds((prev) => new Set(prev).add(id));
    const timeout = setTimeout(() => {
      onToggleFavorite(id, isFavorite);
      setLeavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      leaveTimeoutsRef.current.delete(id);
    }, ROW_LEAVE_ANIMATION_MS);
    leaveTimeoutsRef.current.set(id, timeout);
  };

  const renderRow = (item: CatalogItem, isFavoriteRow: boolean): ReactNode => {
    const isSelected = item.id === selectedId;
    const isLeaving = leavingIds.has(item.id);
    return (
      <li
        key={item.id}
        ref={isSelected ? selectedRowRef : undefined}
        className={isLeaving ? styles.rowLeaving : styles.rowEnter}
      >
        <div
          role="button"
          tabIndex={0}
          className={mergeClasses(
            'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5',
            'transition-colors hover:bg-layer-sunken',
            isSelected
              ? 'border-info bg-accent-primary-alpha'
              : 'border-transparent',
          )}
          onClick={() => handleSelect(item)}
          onKeyDown={(e) => handleItemKeyDown(e, item)}
        >
          <DeploymentIcon
            src={item.iconUrl}
            size={DIAL_ICON_SIZE.MD}
            initialsName={item.name}
          />
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            {query.trim() ? (
              <Highlight
                text={item.name}
                query={query}
                className="dial-small-text !flex-initial"
              />
            ) : (
              <DialEllipsisTooltip
                text={item.name}
                className="dial-small-text !flex-initial"
              />
            )}
            {item.version != null && (
              <span className="dial-tiny-text shrink-0 whitespace-nowrap text-secondary">
                {item.version}
              </span>
            )}
          </div>
          {isSelected && (
            <IconCheck
              size={DIAL_ICON_SIZE.SM}
              className="shrink-0 text-accent"
              aria-hidden
            />
          )}
          {isFavoriteRow ? (
            <GhostIconButton
              icon={
                <IconStarFilled
                  size={DIAL_ICON_SIZE.SM}
                  className="text-warning-icon"
                />
              }
              aria-label={removeFromFavoritesLabel}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(item.id, false);
              }}
            />
          ) : (
            <GhostIconButton
              icon={<IconStar size={DIAL_ICON_SIZE.SM} />}
              aria-label={addToFavoritesLabel}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(item.id, true);
              }}
            />
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex min-w-[240px] flex-col">
      {/* Sticky search header */}
      <div className="sticky top-0 z-10 bg-layer-raised px-1 pb-3 pt-2">
        <SearchBar
          value={query}
          labels={{
            placeholder: searchPlaceholder,
            ariaLabel: searchPlaceholder,
          }}
          onChange={setQuery}
          styles={{
            containerClassName: mergeClasses(
              styles.searchBar,
              '!bg-transparent !rounded-full !shadow-none',
            ),
          }}
        />
      </div>

      <div
        className={mergeClasses('max-h-72 overflow-y-auto', styles.listContent)}
        style={{ height: listHeight }}
      >
        <div ref={listContentRef}>
          {showCurrentlySelected && selectedItem && (
            <>
              <p className={SECTION_HEADING_CLASS_NAME}>
                {currentlySelectedLabel}
              </p>
              <ul className="px-1 pb-1">{renderRow(selectedItem, false)}</ul>
            </>
          )}

          {(showCurrentlySelected || filteredFavorites.length > 0) && (
            <p className={SECTION_HEADING_CLASS_NAME}>{favoritesLabel}</p>
          )}

          {filteredFavorites.length > 0 ? (
            <ul className="flex flex-col gap-1 px-1 pb-1">
              {filteredFavorites.map((item) => renderRow(item, true))}
            </ul>
          ) : (
            <p className="dial-small-text px-4 py-4 text-center text-secondary">
              {emptyHint}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-tertiary px-2 py-1">
        <GhostButton
          label={browseCatalogLabel}
          className="w-full justify-center"
          onClick={handleBrowse}
        />
      </div>
    </div>
  );
};

export default memo(DeploymentSelectorPanel);
