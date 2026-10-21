import {
  buildCssVars,
  FilterTab,
  mergeClasses,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  ElementSize,
  GhostIconButton,
  MenuItemMark,
  Search,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import {
  IconChevronDown,
  IconChevronRight,
  IconFilter2,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import {
  type FC,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { CONVERSATION_PANEL_CLASS } from '../../constants/public-class-names';
import type { ConversationListHeaderProps } from '../../models/conversation-list-header';
import type { FilterLabels } from '../../models/panel-props';
import { ConversationTypeFilter } from '../../types/conversation-kind';
import styles from './ConversationListHeader.module.scss';

/* The kit's small icon button is larger than the design's 24px box (16px glyph). */
const ICON_BUTTON_CLASS = '!size-6 !min-h-0 !min-w-0 !p-1';

const ORIGIN_OPTIONS: ReadonlyArray<{
  value: FilterTab;
  getLabel: (labels: FilterLabels) => string;
}> = [
  { value: FilterTab.All, getLabel: (labels) => labels.all },
  {
    value: FilterTab.MyChats,
    getLabel: (labels) => labels.personal ?? 'Personal',
  },
  { value: FilterTab.Shared, getLabel: (labels) => labels.shared },
  { value: FilterTab.Organization, getLabel: (labels) => labels.organization },
];

const TYPE_OPTIONS: ReadonlyArray<{
  value: ConversationTypeFilter;
  getLabel: (labels: FilterLabels) => string;
}> = [
  { value: ConversationTypeFilter.All, getLabel: (labels) => labels.all },
  {
    value: ConversationTypeFilter.Chat,
    getLabel: (labels) => labels.chat ?? 'Chat',
  },
  {
    value: ConversationTypeFilter.Task,
    getLabel: (labels) => labels.task ?? 'Task',
  },
];

/** Header row for `ConversationList`: a collapsible title, a search toggle, a filter menu and a slot for extra actions. */
export const ConversationListHeader: FC<ConversationListHeaderProps> = memo(
  ({
    labels,
    isExpanded = true,
    onToggleExpanded,
    controlsId,
    searchQuery = '',
    isSearchOpen = false,
    onSearchChange,
    onSearchOpenChange,
    activeFilter = FilterTab.All,
    onFilterChange,
    activeTypeFilter = ConversationTypeFilter.All,
    onTypeFilterChange,
    hiddenSources,
    actions,
    styles: headerStyles,
    className,
  }) => {
    const titleClassName =
      headerStyles?.typography?.titleClassName ?? 'dial-tiny-lead-semi-text';
    const searchTextClassName =
      headerStyles?.typography?.searchTextClassName ?? 'dial-tiny-text';
    const searchToggleRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const wasSearchOpenRef = useRef(isSearchOpen);

    const filterTriggerLabel =
      labels.filterLabels.groupAriaLabel ?? 'Filter chats';
    const isSearchAvailable =
      onSearchChange != null && onSearchOpenChange != null;

    useEffect(() => {
      if (isSearchOpen) {
        searchInputRef.current?.focus();
      } else if (wasSearchOpenRef.current) {
        searchToggleRef.current?.focus();
      }
      wasSearchOpenRef.current = isSearchOpen;
    }, [isSearchOpen]);

    const handleOpenSearch = useCallback(() => {
      onSearchOpenChange?.(true);
    }, [onSearchOpenChange]);

    const handleCloseSearch = useCallback(() => {
      onSearchChange?.('');
      onSearchOpenChange?.(false);
    }, [onSearchChange, onSearchOpenChange]);

    const handleSearchChange = useCallback(
      (value?: string) => {
        onSearchChange?.(value ?? '');
      },
      [onSearchChange],
    );

    const handleSearchKeyDown = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        handleCloseSearch();
      },
      [handleCloseSearch],
    );

    /* One row per filter, each showing its current value and opening a
       single-select submenu. */
    const filterItems = useMemo<DropdownItem[]>(() => {
      const { filterLabels } = labels;
      /* The kit draws a submenu row's chevron itself and ignores
         `rightControl` there, so the row's content is supplied whole: the
         name, then the current value right before the chevron. */
      const renderRow = (name: string, value: string) => () => (
        <>
          <span className="min-w-0 flex-1 truncate text-start">{name}</span>
          <span className="shrink-0 text-secondary">{value}</span>
        </>
      );
      const items: DropdownItem[] = [];

      if (onTypeFilterChange) {
        const typeOptions = TYPE_OPTIONS.map(({ value, getLabel }) => ({
          key: value,
          label: getLabel(filterLabels),
          mark: MenuItemMark.Check,
          checked: value === activeTypeFilter,
          onClick: () => onTypeFilterChange(value),
        }));
        const activeType = TYPE_OPTIONS.find(
          ({ value }) => value === activeTypeFilter,
        );
        items.push({
          key: 'filter-type',
          label: filterLabels.type ?? 'Type',
          renderItem: renderRow(
            filterLabels.type ?? 'Type',
            activeType ? activeType.getLabel(filterLabels) : filterLabels.all,
          ),
          children: typeOptions,
        });
      }

      if (onFilterChange) {
        const visibleOrigins = ORIGIN_OPTIONS.filter(
          ({ value }) => !hiddenSources?.includes(value),
        );
        const activeOrigin = visibleOrigins.find(
          ({ value }) => value === activeFilter,
        );
        items.push({
          key: 'filter-origin',
          label: filterLabels.origin ?? 'Origin',
          renderItem: renderRow(
            filterLabels.origin ?? 'Origin',
            activeOrigin
              ? activeOrigin.getLabel(filterLabels)
              : filterLabels.all,
          ),
          children: visibleOrigins.map(({ value, getLabel }) => ({
            key: value,
            label: getLabel(filterLabels),
            mark: MenuItemMark.Check,
            checked: value === activeFilter,
            onClick: () => onFilterChange(value),
          })),
        });
      }

      return items;
    }, [
      labels,
      hiddenSources,
      activeFilter,
      activeTypeFilter,
      onFilterChange,
      onTypeFilterChange,
    ]);

    const cssVars = useMemo(
      () =>
        buildCssVars({
          '--cp-list-header-title': headerStyles?.colors?.title,
          '--cp-list-header-title-focus': headerStyles?.colors?.titleFocus,
        }),
      [headerStyles?.colors?.title, headerStyles?.colors?.titleFocus],
    );

    /* The search row swaps in a wider gap; the public class stays last on both. */
    const getRootClassName = (layoutClassName?: string): string =>
      mergeClasses(
        'flex min-h-6 items-center justify-between ps-2',
        layoutClassName,
        className,
        CONVERSATION_PANEL_CLASS.listHeader,
      );

    if (isSearchAvailable && isSearchOpen) {
      return (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape handler for the search field it wraps
        <div
          role="search"
          style={cssVars}
          className={getRootClassName('gap-2')}
          onKeyDown={handleSearchKeyDown}
        >
          <Search
            containerClassName="min-w-0 flex-1"
            wrapperClassName={mergeClasses(
              '!h-6 !min-h-0 !py-1 !pe-2 [&_svg]:!size-4',
              searchTextClassName,
            )}
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={labels.searchPlaceholder}
            clearLabel={labels.searchClearLabel}
            aria-label={labels.searchPlaceholder}
          />
          <GhostIconButton
            icon={
              <IconX
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                aria-hidden
              />
            }
            size={ElementSize.Small}
            className={ICON_BUTTON_CLASS}
            aria-label={labels.searchCloseLabel}
            onClick={handleCloseSearch}
          />
        </div>
      );
    }

    const titleText = <span className={titleClassName}>{labels.title}</span>;

    return (
      <div style={cssVars} className={getRootClassName()}>
        {onToggleExpanded ? (
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={controlsId}
            onClick={onToggleExpanded}
            className={mergeClasses(
              'group flex items-center gap-1 rounded',
              styles.title,
            )}
          >
            {titleText}
            {isExpanded ? (
              <IconChevronDown
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden
              />
            ) : (
              <IconChevronRight
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
                className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:scale-x-[-1]"
                aria-hidden
              />
            )}
          </button>
        ) : (
          <span className={styles.title}>{titleText}</span>
        )}

        <div className="flex items-center gap-2">
          {isSearchAvailable && (
            <GhostIconButton
              ref={searchToggleRef}
              icon={
                <IconSearch
                  size={DIAL_ICON_SIZE.SM}
                  stroke={DIAL_KIT_ICON_STROKE}
                  aria-hidden
                />
              }
              size={ElementSize.Small}
              className={ICON_BUTTON_CLASS}
              aria-label={labels.searchOpenLabel}
              onClick={handleOpenSearch}
            />
          )}
          {(onFilterChange || onTypeFilterChange) && (
            <Dropdown
              items={filterItems}
              placement="bottom-end"
              matchReferenceWidth={false}
            >
              <GhostIconButton
                icon={
                  <IconFilter2
                    size={DIAL_ICON_SIZE.SM}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
                  />
                }
                size={ElementSize.Small}
                className={ICON_BUTTON_CLASS}
                aria-label={filterTriggerLabel}
              />
            </Dropdown>
          )}
          {actions}
        </div>
      </div>
    );
  },
);
