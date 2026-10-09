import { mergeClasses, useIsMobile } from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Dropdown,
  DropdownItem,
  DropdownItemType,
  ElementSize,
  PrimaryButton,
  Search,
} from '@epam/ai-dial-ui-kit';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { FC, useRef, useState } from 'react';
import {
  CREATE_MENU_LIST_CLASS_NAME,
  CREATE_MENU_MAX_HEIGHT_PX,
} from '../../constants/create-menu';
import type { CatalogCreateSearch } from '../../models/catalog-props';
import { highlightDropdownLabels } from '../../utils/create-menu';
import { CreateMenuSheet } from './CreateMenuSheet';

/** Props for the catalog Create button. */
export interface CreateButtonProps {
  /** Button label. */
  label: string;
  /**
   * When provided, the button opens a dropdown with these options instead of
   * calling `onClick` directly.
   */
  options?: DropdownItem[];
  /** Called when the button is clicked and no `options` are present. */
  onClick?: () => void;
  /** When provided, the dropdown shows a search field above `options`; the host filters `options` by its value. */
  search?: CatalogCreateSearch;
  /** Placeholder and accessible name of the search field. Defaults to `'Search'`. */
  searchPlaceholder?: string;
  /** Accessible name of the search field's clear button. Defaults to `'Clear search'`. */
  searchClearLabel?: string;
  /** Text shown when a search leaves no options. Defaults to `'No results found'`. */
  noResultsLabel?: string;
  /** Accessible name of the mobile menu sheet's back button. Defaults to `'Back'`. */
  backLabel?: string;
  /** Accessible name of the mobile menu sheet's close button. Defaults to `'Close'`. */
  closeLabel?: string;
}

/** Renders a plain primary button, a split-chevron dropdown, a searchable dropdown, or — on mobile — a menu sheet. */
export const CreateButton: FC<CreateButtonProps> = ({
  label,
  options,
  onClick,
  search,
  searchPlaceholder = 'Search',
  searchClearLabel = 'Clear search',
  noResultsLabel = 'No results found',
  backLabel = 'Back',
  closeLabel = 'Close',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const chevron = (
    <IconChevronDown
      size={DIAL_ICON_SIZE.SM}
      stroke={DIAL_KIT_ICON_STROKE}
      aria-hidden
      className={mergeClasses('transition-transform', isOpen && 'rotate-180')}
    />
  );

  // A floating menu's side flyouts fall off a phone screen, so below the desktop breakpoint the menu is a sheet.
  if (isMobile && (search || options?.length)) {
    const handleSheetClose = () => {
      setIsOpen(false);
      search?.onChange('');
    };

    return (
      <>
        <Button
          label={label}
          variant={ButtonVariant.Primary}
          appearance={ButtonAppearance.Solid}
          iconAfter={chevron}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        />
        <CreateMenuSheet
          open={isOpen}
          onClose={handleSheetClose}
          title={label}
          options={options ?? []}
          search={search}
          searchPlaceholder={searchPlaceholder}
          searchClearLabel={searchClearLabel}
          noResultsLabel={noResultsLabel}
          backLabel={backLabel}
          closeLabel={closeLabel}
        />
      </>
    );
  }

  if (search) {
    const searchItems: DropdownItem[] = options?.length
      ? highlightDropdownLabels(options, search.value)
      : [
          {
            key: 'no-results',
            type: DropdownItemType.PlainText,
            label: <span role="status">{noResultsLabel}</span>,
          },
        ];
    const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) search.onChange('');
    };

    return (
      <div ref={containerRef}>
        <Dropdown
          items={searchItems}
          maxDropdownHeight={CREATE_MENU_MAX_HEIGHT_PX}
          placement="bottom-end"
          matchReferenceWidth={false}
          listClassName={CREATE_MENU_LIST_CLASS_NAME}
          menuHeader={
            <div className="sticky -top-1 z-10 bg-layer-raised px-2 pb-1 pt-2">
              <Search
                value={search.value}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                clearLabel={searchClearLabel}
                size={ElementSize.Small}
                onChange={(value) => search.onChange(value ?? '')}
              />
            </div>
          }
          onOpenChange={handleOpenChange}
        >
          <Button
            label={label}
            variant={ButtonVariant.Primary}
            appearance={ButtonAppearance.Solid}
            iconAfter={chevron}
            aria-haspopup="menu"
            aria-expanded={isOpen}
          />
        </Dropdown>
      </div>
    );
  }

  if (!options?.length) {
    return (
      <PrimaryButton
        label={label}
        iconBefore={
          <IconPlus size={DIAL_ICON_SIZE.SM} stroke={DIAL_KIT_ICON_STROKE} />
        }
        onClick={onClick}
      />
    );
  }

  return (
    <div ref={containerRef}>
      <ButtonDropdown
        appearance={ButtonAppearance.Solid}
        label={label}
        variant={ButtonVariant.Primary}
        items={options}
      />
    </div>
  );
};
