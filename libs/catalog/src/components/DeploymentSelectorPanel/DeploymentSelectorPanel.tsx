import {
  buildCssVars,
  CatalogEntityType,
  DeploymentIcon,
  mergeClasses,
  SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
  SELECT_LIST_MAX_HEIGHT_PX,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EllipsisTooltip,
  GhostButton,
  Highlight,
  MenuItem,
  MenuItemMark,
  Search,
  ToggleIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import type { DeploymentSelectorPanelProps } from '../../models/deployment-selector-panel';
import { DeploymentSelectorLayout } from '../../types/deployment-selector-layout';
import { getCatalogItemTabs } from '../../utils/catalog-tabs';
import { scrollChildIntoContainerView } from '../../utils/scroll-window';
import type { DeploymentSelectorExtraOption } from '../DeploymentSelectorField/DeploymentSelectorField';
import styles from './DeploymentSelectorPanel.module.scss';

// Must match the .rowLeaving exit-animation duration in DeploymentSelectorPanel.module.scss.
const ROW_LEAVE_ANIMATION_MS = 180;

const matchesQuery = (item: CatalogItem, query: string): boolean => {
  const q = query.toLowerCase();
  return (
    item.name.toLowerCase().includes(q) ||
    item.topics.some((t) => t.toLowerCase().includes(q)) ||
    item.folder.some((s) => s.toLowerCase().includes(q))
  );
};

const isModelOrAgent = (item: CatalogItem): boolean =>
  getCatalogItemTabs(item).some(
    (tab) => tab === CatalogEntityType.Model || tab === CatalogEntityType.Agent,
  );

/* Module-level so the default never changes identity between renders. */
const NO_EXTRA_OPTIONS: DeploymentSelectorExtraOption[] = [];

/** Searchable model/agent picker panel with a selected row, favourites with star toggles, and a catalog footer button. */
export const DeploymentSelectorPanel: FC<DeploymentSelectorPanelProps> = ({
  favorites,
  extraOptions = NO_EXTRA_OPTIONS,
  pinnedItem,
  canFavoritePinnedItem = true,
  selectedId,
  selectedItem,
  isSelectableItem = isModelOrAgent,
  layout = DeploymentSelectorLayout.Sectioned,
  onSelect,
  onToggleFavorite,
  onBrowseCatalog,
  onClose,
  labels = {},
  colors,
  sectionHeadingClassName = 'dial-tiny-lead-semi-text',
  itemNameClassName = 'dial-small-text',
  emptyHintClassName = 'dial-small-text',
  className,
}) => {
  const {
    searchPlaceholder = 'Search models, agents…',
    clearSearchLabel = 'Clear search',
    favoritesLabel = 'Favorites',
    emptyHint = 'Star a model or agent to pin it here.',
    browseCatalogLabel = 'Catalog',
    removeFromFavoritesLabel = 'Remove from favorites',
    currentlySelectedLabel = 'Currently selected',
    addToFavoritesLabel = 'Add to favorites',
    listAriaLabel = 'Select model',
    unavailableLabel = 'Unavailable',
  } = labels;
  const isSectioned = layout === DeploymentSelectorLayout.Sectioned;

  const [query, setQuery] = useState('');
  const handleSearchChange = (value?: string) => {
    setQuery(value ?? '');
  };
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

  const quickItems = useMemo(() => {
    const items =
      pinnedItem == null
        ? favorites
        : [
            pinnedItem,
            ...favorites.filter((item) => item.id !== pinnedItem.id),
          ];
    /* Entities tagged with an operator HIDDEN_ENTITY_TAGS tag stay out of the
       picker the same way the Catalog drops them. */
    return items.filter((item) => !item.isHidden && isSelectableItem(item));
  }, [favorites, pinnedItem, isSelectableItem]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.id)),
    [favorites],
  );

  const trimmedQuery = query.trim();

  /*
   * The sectioned layout gives the selection its own section, so the list
   * never repeats it; the flat layout adds the selection to the list only
   * when the list does not already hold it.
   */
  const isSelectionInList =
    selectedItem != null &&
    quickItems.some((item) => item.id === selectedItem.id);
  const showSelected =
    selectedItem != null &&
    isSelectableItem(selectedItem) &&
    (isSectioned || !isSelectionInList) &&
    (!trimmedQuery || matchesQuery(selectedItem, query));

  const filteredItems = useMemo(() => {
    const listItems = isSectioned
      ? quickItems.filter((item) => item.id !== selectedItem?.id)
      : quickItems;
    if (!trimmedQuery) return listItems;
    return listItems.filter((item) => matchesQuery(item, query));
  }, [quickItems, isSectioned, trimmedQuery, query, selectedItem?.id]);

  const filteredExtraOptions = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return extraOptions;
    return extraOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [extraOptions, trimmedQuery]);

  /*
   * Animates the scrollable list's own height across structural changes
   * (a row moving into or out of the selected slot) instead of letting it
   * snap instantly, since CSS can't transition height: auto.
   */
  const listContentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState<number>();

  useLayoutEffect(() => {
    if (listContentRef.current) {
      setListHeight(
        Math.min(
          listContentRef.current.scrollHeight,
          SELECT_LIST_MAX_HEIGHT_PX,
        ),
      );
    }
  }, [filteredItems, filteredExtraOptions, showSelected]);

  /*
   * Panel is remounted fresh each time the popover opens, so without this the
   * scrollable list always starts scrolled to the top even when the selected
   * item sits further down, making it look like the pick didn't take effect.
   */
  const selectedRowRef = useRef<HTMLLIElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  /* Scoped to the list: `scrollIntoView` would also scroll the mobile bottom
     sheet's backdrop while the sheet is still sliding up, so the sheet jumps
     past its resting place and snaps back. */
  useEffect(() => {
    if (listScrollRef.current && selectedRowRef.current) {
      scrollChildIntoContainerView(
        listScrollRef.current,
        selectedRowRef.current,
      );
    }
  }, []);

  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);

  /*
   * The kit's 2.0 `Dropdown` mounts its overlay with `initialFocus={-1}`, so
   * it never moves focus off the trigger — a keyboard user would open the
   * panel and stay parked outside it. Claiming focus here is what makes the
   * panel keyboard-operable. Skipped on mobile, where the same panel renders
   * inside a bottom sheet and focusing the field would raise the on-screen
   * keyboard over the list the user came to read.
   */
  useEffect(() => {
    if (isMobile) return;
    searchInputRef.current?.focus();
  }, [isMobile]);

  const handleSelectId = (id: string) => {
    onSelect(id);
    onClose();
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

  const renderName = (text: string): ReactNode =>
    trimmedQuery ? (
      <Highlight
        text={text}
        query={query}
        className={mergeClasses(itemNameClassName, 'min-w-0 flex-initial!')}
      />
    ) : (
      <EllipsisTooltip
        text={text}
        className={mergeClasses(itemNameClassName, 'min-w-0 flex-initial!')}
      />
    );

  /*
   * Same row chrome as a deployment row — tinted when chosen, `menuitemradio`
   * in the same menu — minus the icon and the favourite toggle, neither of
   * which a mode has.
   */
  const renderExtraRow = (option: DeploymentSelectorExtraOption): ReactNode => {
    const isSelected = option.id === selectedId;
    return (
      <li
        key={option.id}
        role="none"
        ref={isSelected ? selectedRowRef : undefined}
      >
        <MenuItem
          role="menuitemradio"
          aria-checked={isSelected}
          mark={MenuItemMark.Tint}
          selected={isSelected}
          className="h-auto py-1.5"
          label={renderName(option.label)}
          onClick={() => handleSelectId(option.id)}
        />
      </li>
    );
  };

  const renderRow = (
    item: CatalogItem,
    isSelectedSectionRow = false,
  ): ReactNode => {
    const isSelected = item.id === selectedId;
    const isFavoriteRow = favoriteIds.has(item.id);
    /* An existing chat can still point at a deployment the operator has since
       hidden via HIDDEN_ENTITY_TAGS. It stays visible as the current choice but
       can't be re-picked or starred. */
    const isUnavailable = !!item.isHidden;
    const hasStar =
      !isUnavailable && (canFavoritePinnedItem || item.id !== pinnedItem?.id);
    // The selected section keeps its row when unstarred, so it never plays the exit animation.
    const isLeaving = !isSelectedSectionRow && leavingIds.has(item.id);
    return (
      <li
        key={item.id}
        role="none"
        ref={isSelected ? selectedRowRef : undefined}
        className={isLeaving ? styles.rowLeaving : styles.rowEnter}
      >
        {/*
          Picking a deployment is choosing a value, so the design tints the
          chosen row instead of checking it. The favourite toggle goes through
          `rightControl`: it is a button, and a button nested inside the row's
          own button would be invalid markup, swallow the row's click, and land
          inside the row's accessible name.
        */}
        <MenuItem
          role="menuitemradio"
          aria-checked={isSelected}
          mark={MenuItemMark.Tint}
          selected={isSelected}
          className="h-auto py-1.5"
          disabled={isUnavailable}
          description={isUnavailable ? unavailableLabel : undefined}
          icon={
            <DeploymentIcon
              src={item.iconUrl}
              size={DIAL_ICON_SIZE.MD}
              initialsName={item.name}
            />
          }
          label={
            <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-1.5 whitespace-normal">
              {renderName(item.name)}
              {item.version && (
                <CaptionText
                  text={item.version}
                  className="min-w-0 wrap-break-word"
                />
              )}
            </span>
          }
          onClick={() => handleSelectId(item.id)}
          rightControl={
            hasStar ? (
              <ToggleIconButton
                icon={
                  <IconStar
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                }
                selectedIcon={
                  <IconStarFilled
                    size={DIAL_ICON_SIZE.SM}
                    className={styles.starFilledIcon}
                    aria-hidden
                  />
                }
                isSelected={isFavoriteRow}
                aria-label={
                  isFavoriteRow ? removeFromFavoritesLabel : addToFavoritesLabel
                }
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFavorite(item.id, !isFavoriteRow);
                }}
              />
            ) : undefined
          }
        />
      </li>
    );
  };

  const renderEmptyHint = (): ReactNode => (
    <p
      className={mergeClasses(
        emptyHintClassName,
        'px-4 py-4 text-center',
        styles.emptyHint,
      )}
    >
      {emptyHint}
    </p>
  );

  const renderSectionedList = (): ReactNode => (
    <>
      {showSelected && selectedItem && (
        <>
          <p
            className={mergeClasses(
              sectionHeadingClassName,
              'px-3 pt-2 pb-2',
              styles.sectionHeading,
            )}
          >
            {currentlySelectedLabel}
          </p>
          <ul role="group" className="flex flex-col gap-1 px-1 pb-1">
            {renderRow(selectedItem, true)}
          </ul>
        </>
      )}

      {(showSelected || filteredItems.length > 0) && (
        <p
          className={mergeClasses(
            sectionHeadingClassName,
            'sticky top-0 z-10 px-3 pt-2 pb-2 will-change-transform',
            styles.sectionHeading,
            styles.stickyHeading,
          )}
        >
          {favoritesLabel}
        </p>
      )}

      {filteredItems.length > 0 ? (
        <ul role="group" className="flex flex-col gap-1 px-1 pb-1">
          {filteredItems.map((item) => renderRow(item))}
        </ul>
      ) : (
        renderEmptyHint()
      )}
    </>
  );

  const renderFlatList = (): ReactNode => {
    const [first, ...rest] = filteredItems;
    const hasPinnedRow = first != null && first.id === pinnedItem?.id;
    const favoriteRows = hasPinnedRow ? rest : filteredItems;
    const rows = [
      ...(hasPinnedRow ? [first] : []),
      ...(showSelected && selectedItem ? [selectedItem] : []),
      ...favoriteRows,
    ];
    return (
      <>
        {rows.length > 0 && (
          <ul role="group" className="flex flex-col gap-1 px-1 py-1">
            {rows.map((item) => renderRow(item))}
          </ul>
        )}
        {favoriteRows.length === 0 && !hasPinnedRow && renderEmptyHint()}
      </>
    );
  };

  return (
    <div
      className={mergeClasses('flex min-w-[360px] flex-col', className)}
      /*
       * Bound to the kit Dropdown's own live available-height var (set by
       * floating-ui) so the list, not the outer popup wrapper, absorbs any
       * height constraint — the wrapper's overflow-auto would otherwise clip
       * the footer instead of letting the list shrink. The -8px accounts for
       * the wrapper's own p-1 (4px top + 4px bottom) padding.
       */
      style={{
        maxHeight: 'calc(var(--fui-available-height, 9999px) - 8px)',
        ...buildCssVars({
          '--ds-surface': colors?.surface,
          '--ds-section-heading': colors?.sectionHeading,
          '--ds-empty-hint': colors?.emptyHint,
          '--ds-footer-border': colors?.footerBorder,
          '--ds-star-filled': colors?.starFilled,
        }),
      }}
    >
      <div
        role="search"
        className={mergeClasses(
          'sticky top-0 z-10 pt-2 pb-3',
          styles.searchHeader,
        )}
      >
        <Search
          inputRef={searchInputRef}
          value={query}
          onChange={handleSearchChange}
          placeholder={searchPlaceholder}
          clearLabel={clearSearchLabel}
          aria-label={searchPlaceholder}
        />
      </div>

      <div
        ref={listScrollRef}
        className={mergeClasses(
          SELECT_LIST_MAX_HEIGHT_CLASS_NAME,
          'min-h-0 flex-1 overflow-y-auto',
          styles.listContent,
        )}
        style={{ maxHeight: listHeight }}
      >
        {/* The radio rows below are grouped per section, so the scroll body is
            the menu that owns them. */}
        <div role="menu" aria-label={listAriaLabel} ref={listContentRef}>
          {filteredExtraOptions.length > 0 && (
            <ul role="group" className="flex flex-col gap-1 px-1 pt-1 pb-1">
              {filteredExtraOptions.map(renderExtraRow)}
            </ul>
          )}
          {isSectioned ? renderSectionedList() : renderFlatList()}
        </div>
      </div>

      <div className={mergeClasses('px-2 py-3', styles.footer)}>
        <GhostButton
          label={browseCatalogLabel}
          className="w-full justify-center"
          onClick={handleBrowse}
        />
      </div>
    </div>
  );
};
