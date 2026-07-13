import { SearchBar } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';

/** Props for `SearchInput`. */
export interface SearchInputProps {
  /** Placeholder text (e.g. `"Search chat…"`). */
  placeholder: string;
  /** Current search query value. */
  value: string;
  /** Called whenever the query changes. */
  onChange: (value: string) => void;
  /** Accessible label for the clear-search button. */
  clearLabel: string;
  /** CSS class applied to the search icon. Defaults to `'!text-secondary'`. */
  iconClassName?: string;
}

/**
 * Minimal search input with icon positioned to align with sibling action buttons.
 * Reuses the shared {@link SearchBar} default colors (border, hover/focus, icon
 * and text colors) and only adjusts shape (pill) and background for the sidebar.
 */
export const SearchInput: FC<SearchInputProps> = memo(
  ({
    placeholder,
    value,
    onChange,
    clearLabel,
    iconClassName = 'text-secondary',
  }) => (
    <div className="px-3 py-2">
      <SearchBar
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        clearLabel={clearLabel}
        iconClassName={iconClassName}
        iconSize={DIAL_ICON_SIZE.SM}
        iconStrokeWidth={1.5}
        containerClassName="min-h-11 w-full gap-2 rounded-full border pe-3 ps-3 desktop:min-h-9"
        clearButtonClassName="size-11 desktop:size-6"
      />
    </div>
  ),
);
