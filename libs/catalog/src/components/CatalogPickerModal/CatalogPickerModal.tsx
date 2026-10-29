import { buildCssVars, ItemHeader } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  ElementSize,
  mergeClasses,
  MenuItemMark,
  NeutralButton,
  NoDataContent,
  Popup,
  PopupSize,
  PrimaryButton,
  Search,
  Spinner,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { type FC, type ReactNode, useCallback, useMemo, useState } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import type { ListViewProps } from '../../models/list-props';
import { CatalogLoadStatus } from '../../types/load-status';
import { CatalogSortKey } from '../../types/sort';
import {
  filterCatalogItemsByQuery,
  getTopicOptions,
} from '../../utils/catalog-filter';
import { Filter } from '../Filter/Filter';
import { ListView } from '../ListView/ListView';
import styles from './CatalogPickerModal.module.scss';

/** User-visible strings of `CatalogPickerModal`; pass translated ones in a localised host. */
export interface CatalogPickerModalLabels {
  /** Dialog title, e.g. "Add toolset". */
  title: string;
  /** Heading above the list, e.g. "Toolsets catalog". */
  catalog: string;
  /** Search placeholder and accessible name. Defaults to `'Search'`. */
  search?: string;
  /** Accessible name of the loading spinner. Defaults to `'Loading'`. */
  loading?: string;
  /** Title shown when the items failed to load. Defaults to `'Failed to load'`. */
  failedToLoad?: string;
  /** Title shown when the catalog has no items at all. Defaults to `'Nothing here yet'`. */
  empty?: string;
  /** Title shown when the search or filter leaves no items. Defaults to `'No results found'`. */
  noResults?: string;
  /** Retry button label. Defaults to `'Retry'`. */
  retry?: string;
  /** Sort button label while no sort option matches. Defaults to `'Sort'`. */
  sort?: string;
  /** "Recently updated" sort option. Defaults to `'Recently Updated'`. */
  sortUpdated?: string;
  /** "Newest" sort option. Defaults to `'Newest'`. */
  sortNewest?: string;
  /** "Name A-Z" sort option. Defaults to `'Name A-Z'`. */
  sortNameAZ?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancel?: string;
  /** Confirm button label. Defaults to `'Add'`. */
  add?: string;
  /** Accessible name of the dialog's close button. Defaults to `'Close dialog'`. */
  closeDialog?: string;
  /** Accessible name of the search's clear button. Defaults to `'Clear search'`. */
  clearSearch?: string;
  /** From filter trigger label. Defaults to `'From'`. */
  from?: string;
  /** From filter "My" option. Defaults to `'My'`. */
  my?: string;
  /** From filter topics heading. Defaults to `'Topics'`. */
  topics?: string;
  /** From filter Clear button. Defaults to `'Clear'`. */
  clear?: string;
  /** From filter Apply button. Defaults to `'Apply'`. */
  apply?: string;
}

/**
 * The default list's `ListView` props: everything but the rows and the query,
 * which the picker supplies. `ariaLabel` defaults to `labels.catalog`.
 */
export type CatalogPickerListProps = Omit<ListViewProps, 'items' | 'query'>;

/** Color overrides for `CatalogPickerModal`. */
export interface CatalogPickerModalColors {
  /** Color of the rule above the footer drawn with `footerStart`. Defaults to `--stroke-tertiary`. */
  footerBorder?: string;
}

/** Props for `CatalogPickerModal` shared by the default and the custom list. */
interface CatalogPickerModalBaseProps {
  /** The items the user can pick from, already mapped to catalog items. */
  items: CatalogItem[];
  /** User-visible strings. */
  labels: CatalogPickerModalLabels;
  /** Where the items' data stands. */
  status: CatalogLoadStatus;
  /** Why the items failed to load, shown under the failure title. */
  error?: string | null;
  /** Called by the Retry button shown on a failure; without it there is no Retry. */
  onRetry?: () => void;
  /** Keeps the confirm button disabled on top of the items not being ready. Defaults to `false`. */
  isConfirmDisabled?: boolean;
  /** The choice's own options (a model's effort, say), at the footer's start. */
  footerStart?: ReactNode;
  /** Color overrides, applied as CSS custom properties. */
  colors?: CatalogPickerModalColors;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels or closes the dialog. */
  onClose: () => void;
}

/**
 * Props for `CatalogPickerModal`: either `listProps`, for the default list (a
 * `ListView` of the searched, filtered and sorted items), or `renderList`, for
 * a list of the host's own.
 */
export type CatalogPickerModalProps = CatalogPickerModalBaseProps &
  (
    | {
        /** The default list's `ListView` props, e.g. `type`, `selectedItemId` and `onItemClick`. */
        listProps: CatalogPickerListProps;
        renderList?: never;
      }
    | {
        listProps?: never;
        /** Renders the list for the searched, filtered and sorted items, with the search query to highlight. */
        renderList: (items: CatalogItem[], query: string) => ReactNode;
      }
  );

/*
 * The kit means its Popup to fill the screen below its `md` breakpoint
 * (768px), but its overlay keeps a 24px padding there and the dialog its
 * rounded corners and content height. The project's `mobile` variant ends at
 * 1279px, which would put a picker framed at 800–1279px full-screen, so these
 * follow the kit's breakpoint instead. `!overflow-hidden` beats the overlay's
 * inline `overflow: auto`, which drew a stray scrollbar beside a dialog that
 * already fits.
 */
const FULLSCREEN_BELOW_MD = {
  overlayClassName: 'p-4 max-[767px]:p-0 !overflow-hidden',
  className: 'rounded-xl max-[767px]:h-full max-[767px]:rounded-none',
  headerClassName: 'px-6 py-4 max-[767px]:px-4 max-[767px]:py-3',
  footerClassName: 'px-6 py-4 max-[767px]:px-4 max-[767px]:py-3',
};

/**
 * Shell of a catalog picker dialog (Add toolset, Change model): the header with
 * sort, search and the From filter, and the loading, failure and empty states.
 * The list is a `ListView` given `listProps`, or the host's own from
 * `renderList`. Mount it only while open, so search, filter and sort start
 * fresh each time it opens.
 */
export const CatalogPickerModal: FC<CatalogPickerModalProps> = ({
  items,
  labels,
  status,
  error,
  onRetry,
  isConfirmDisabled = false,
  footerStart,
  colors,
  onConfirm,
  onClose,
  listProps,
  renderList,
}) => {
  const [search, setSearch] = useState('');
  const [topics, setTopics] = useState<Set<string>>(() => new Set());
  const [isMyOnly, setIsMyOnly] = useState(false);
  const [sortKey, setSortKey] = useState<string>(
    CatalogSortKey.RecentlyUpdated,
  );

  const isReady = status === CatalogLoadStatus.Ready;
  const canConfirm = isReady && !isConfirmDisabled;
  const cancelLabel = labels.cancel ?? 'Cancel';
  const addLabel = labels.add ?? 'Add';

  const topicOptions = useMemo(() => getTopicOptions(items), [items]);
  const rows = useMemo(
    () =>
      filterCatalogItemsByQuery(items, { search, topics, isMyOnly, sortKey }),
    [items, search, topics, isMyOnly, sortKey],
  );

  const sortOptions = useMemo(
    () => [
      {
        value: CatalogSortKey.RecentlyUpdated,
        label: labels.sortUpdated ?? 'Recently Updated',
      },
      { value: CatalogSortKey.Newest, label: labels.sortNewest ?? 'Newest' },
      { value: CatalogSortKey.NameAZ, label: labels.sortNameAZ ?? 'Name A-Z' },
    ],
    [labels.sortUpdated, labels.sortNewest, labels.sortNameAZ],
  );
  const sortItems = useMemo<DropdownItem[]>(
    () =>
      sortOptions.map((option) => ({
        key: option.value,
        label: option.label,
        mark: MenuItemMark.Check,
        checked: option.value === sortKey,
        onClick: () => setSortKey(option.value),
      })),
    [sortOptions, sortKey],
  );
  const activeSortLabel =
    sortOptions.find((option) => option.value === sortKey)?.label ??
    labels.sort ??
    'Sort';

  const handleSearchChange = useCallback(
    (next?: string) => setSearch(next ?? ''),
    [],
  );
  const handleConfirm = useCallback(() => {
    if (canConfirm) onConfirm();
  }, [canConfirm, onConfirm]);

  const mainButtons = useMemo(
    () => [
      {
        label: cancelLabel,
        variant: ButtonVariant.Primary,
        appearance: ButtonAppearance.Ghost,
        onClick: onClose,
      },
      { label: addLabel, disabled: !canConfirm, onClick: handleConfirm },
    ],
    [cancelLabel, addLabel, onClose, canConfirm, handleConfirm],
  );

  /*
   * The kit's footer takes buttons only; with options beside them it takes a
   * node, which it renders bare. So this draws what the kit's footer draws —
   * its rule, gap and padding — with the options at the start and the same two
   * buttons at the end.
   */
  const footer =
    footerStart == null ? undefined : (
      <div
        className={mergeClasses(
          'flex flex-wrap items-center justify-between gap-2 border-t',
          styles.footer,
          FULLSCREEN_BELOW_MD.footerClassName,
        )}
        style={buildCssVars({
          '--cat-picker-footer-border': colors?.footerBorder,
        })}
      >
        <div className="flex flex-wrap items-center gap-4">{footerStart}</div>
        <div className="ms-auto flex items-center gap-2">
          <PrimaryButton
            label={cancelLabel}
            appearance={ButtonAppearance.Ghost}
            onClick={onClose}
          />
          <NeutralButton
            label={addLabel}
            disabled={!canConfirm}
            onClick={handleConfirm}
          />
        </div>
      </div>
    );

  const renderBody = (): ReactNode => {
    if (status === CatalogLoadStatus.Loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <Spinner
            size={32}
            fullWidth={false}
            ariaLabel={labels.loading ?? 'Loading'}
          />
        </div>
      );
    }
    if (status === CatalogLoadStatus.Error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <NoDataContent
            title={labels.failedToLoad ?? 'Failed to load'}
            description={error ?? undefined}
          />
          {onRetry && (
            <NeutralButton label={labels.retry ?? 'Retry'} onClick={onRetry} />
          )}
        </div>
      );
    }
    if (rows.length === 0) {
      const isFiltered = search.trim() !== '' || topics.size > 0 || isMyOnly;
      return (
        <div className="py-8">
          <NoDataContent
            title={
              isFiltered
                ? (labels.noResults ?? 'No results found')
                : (labels.empty ?? 'Nothing here yet')
            }
          />
        </div>
      );
    }
    if (renderList) return renderList(rows, search);
    /* The grid scrolls its own rows, so this box only gives it the height left
       below the search and filters. */
    return (
      <div className="min-h-0 flex-1">
        <ListView
          ariaLabel={labels.catalog}
          {...listProps}
          items={rows}
          query={search}
        />
      </div>
    );
  };

  const searchLabel = labels.search ?? 'Search';

  return (
    <Popup
      open
      header={labels.title}
      headerDivider
      footerDivider
      size={PopupSize.Lg}
      {...FULLSCREEN_BELOW_MD}
      closeAriaLabel={labels.closeDialog ?? 'Close dialog'}
      // Full-screen below the kit's `md` the body takes what is left; from there up its height is fixed.
      bodyClassName="flex min-h-0 flex-col overflow-hidden px-6 py-2 h-[70vh] max-[767px]:h-auto max-[767px]:px-4"
      mainButtons={mainButtons}
      footer={footer}
      onClose={onClose}
    >
      <div className="flex shrink-0 flex-col gap-3 pb-5">
        <div className="flex items-center gap-2">
          <ItemHeader
            title={labels.catalog}
            postfix={isReady ? rows.length : undefined}
            titleClassName="dial-body-semi-text"
            shouldTruncateTitle={false}
          />
          <div className="ms-auto shrink-0">
            <ButtonDropdown
              items={sortItems}
              label={activeSortLabel}
              variant={ButtonVariant.Primary}
              appearance={ButtonAppearance.Ghost}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div role="search" className="flex-1">
            <Search
              value={search}
              onChange={handleSearchChange}
              size={ElementSize.Large}
              // Matches the 48px Filter button, as the catalog's own toolbar does.
              wrapperClassName="dial-kit-input-large"
              placeholder={searchLabel}
              aria-label={searchLabel}
              clearLabel={labels.clearSearch ?? 'Clear search'}
            />
          </div>
          <Filter
            checked={topics}
            onChange={setTopics}
            values={topicOptions}
            isMyAppsActive={isMyOnly}
            onMyAppsChange={setIsMyOnly}
            defaultLabel={labels.from ?? 'From'}
            myAppsLabel={labels.my ?? 'My'}
            topicsLabel={labels.topics ?? 'Topics'}
            clearLabel={labels.clear ?? 'Clear'}
            applyLabel={labels.apply ?? 'Apply'}
          />
        </div>
      </div>
      {renderBody()}
    </Popup>
  );
};
