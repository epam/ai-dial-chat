import {
  BottomSheet,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  DropdownItem,
  DropdownItemType,
  ElementSize,
  MenuItem,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconChevronRight } from '@tabler/icons-react';
import type { FC, MouseEvent } from 'react';
import { useState } from 'react';
import type { CatalogCreateSearch } from '../../models/catalog-props';
import { highlightDropdownLabels } from '../../utils/create-menu';

/** Props for the mobile Create menu sheet. */
export interface CreateMenuSheetProps {
  /** Whether the sheet is shown. */
  open: boolean;
  /** Called when the sheet closes — dismissed or after an option is chosen. */
  onClose: () => void;
  /** Title of the root page. */
  title: string;
  /** Options of the root page; an option with `children` drills into a page of its own. */
  options: DropdownItem[];
  /** When provided, the root page shows a search field above `options`; the host filters `options` by its value. */
  search?: CatalogCreateSearch;
  /** Placeholder and accessible name of the search field. */
  searchPlaceholder: string;
  /** Accessible name of the search field's clear button. */
  searchClearLabel: string;
  /** Text shown when a search leaves no options. */
  noResultsLabel: string;
  /** Accessible name of the header's back button. */
  backLabel: string;
  /** Accessible name of the header's close button. */
  closeLabel: string;
}

/**
 * The Create menu below the desktop breakpoint: a bottom sheet instead of a
 * floating dropdown, so a nested option such as Skill drills into a page of
 * its own rather than opening a side flyout that falls off a narrow screen.
 */
export const CreateMenuSheet: FC<CreateMenuSheetProps> = ({
  open,
  onClose,
  title,
  options,
  search,
  searchPlaceholder,
  searchClearLabel,
  noResultsLabel,
  backLabel,
  closeLabel,
}) => {
  const [parentKey, setParentKey] = useState<string | null>(null);
  const parent = parentKey
    ? options.find((option) => option.key === parentKey)
    : undefined;
  const pageItems = parent?.children ?? options;
  const items = search
    ? highlightDropdownLabels(pageItems, search.value)
    : pageItems;

  const handleClose = () => {
    setParentKey(null);
    onClose();
  };

  const handleSelect = (item: DropdownItem, event: MouseEvent) => {
    if (item.children?.length) {
      setParentKey(item.key);
      return;
    }
    item.onClick?.({ key: item.key, domEvent: event });
    handleClose();
  };

  return (
    <BottomSheet
      open={open}
      title={parent ? String(parent.label ?? '') : title}
      onBack={parent ? () => setParentKey(null) : undefined}
      backAriaLabel={backLabel}
      closeAriaLabel={closeLabel}
      onClose={handleClose}
    >
      {search && !parent && (
        <div className="px-2 pb-1 pt-2">
          <Search
            value={search.value}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            clearLabel={searchClearLabel}
            size={ElementSize.Small}
            onChange={(value) => search.onChange(value ?? '')}
          />
        </div>
      )}
      {items.length ? (
        <div role="menu" aria-label={parent ? undefined : title}>
          {items
            .filter((item) => item.type !== DropdownItemType.PlainText)
            .map((item) => (
              <MenuItem
                key={item.key}
                role="menuitem"
                label={item.label}
                icon={item.icon}
                disabled={item.disabled}
                danger={item.danger}
                aria-haspopup={item.children?.length ? 'menu' : undefined}
                trailing={
                  item.children?.length ? (
                    <IconChevronRight
                      size={DIAL_ICON_SIZE.SM}
                      stroke={DIAL_KIT_ICON_STROKE}
                      className="rtl:scale-x-[-1]"
                      aria-hidden
                    />
                  ) : undefined
                }
                onClick={(event) => handleSelect(item, event)}
              />
            ))}
        </div>
      ) : (
        <p role="status" className="px-3 py-2">
          {noResultsLabel}
        </p>
      )}
    </BottomSheet>
  );
};
