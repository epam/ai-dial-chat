import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchBar as BaseSearchBar } from '@epam/ai-dial-kit';
import { type FC } from 'react';

/** Props for SearchBar. */
export interface SearchBarProps {
  /** Current search query value. */
  value: string;
  /** Called on every keystroke with the new value. */
  onChange: (value: string) => void;
  /** Input placeholder text. Default: 'Search'. */
  placeholder?: string;
  /**
   * Accessible label for the input element.
   * Defaults to the `placeholder` value, or `'Search'` if neither is provided.
   */
  ariaLabel?: string;
  /** Additional CSS class applied to the container for layout purposes (e.g. flex-1). */
  className?: string;
  /**
   * Accessible label for the clear-search button. When provided, a clear (X) button is shown once `value` is non-empty.
   * App callers must pass a translated label.
   */
  clearLabel?: string;
}

/**
 * Catalog search bar. Reuses the shared {@link BaseSearchBar} default colors
 * (background, border, hover/focus, icon and text colors) and only adjusts
 * height, radius, padding, and icon/text size for the catalog layout.
 */
export const SearchBar: FC<SearchBarProps> = ({
  placeholder = 'Search',
  className,
  ...rest
}) => (
  <BaseSearchBar
    placeholder={placeholder}
    {...rest}
    iconSize={18}
    iconStrokeWidth={1.8}
    containerClassName={mergeClasses(
      'h-[50px] flex-1 rounded-xl px-[18px]',
      className,
    )}
    inputClassName="text-[15px]"
    clearButtonClassName="size-11 desktop:size-auto"
  />
);
