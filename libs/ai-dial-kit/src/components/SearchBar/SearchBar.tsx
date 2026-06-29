import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconSearch } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from './SearchBar.module.scss';

/** Props for the {@link SearchBar} component. */
export interface SearchBarProps {
  /** Current search value. */
  value: string;
  /** Called when the search value changes. */
  onChange: (value: string) => void;
  /** Placeholder text shown when the input is empty. Defaults to `'Search'`. */
  placeholder?: string;
  /** Accessible label for the input. Falls back to `placeholder` when omitted. */
  ariaLabel?: string;
}

/**
 * A search bar with a leading search icon and a plain text input.
 *
 * Renders a styled rounded container whose border and shadow update on
 * hover and focus-within to signal interactivity.
 *
 * @example
 * ```tsx
 * <SearchBar
 *   value={query}
 *   placeholder="Search models, tools, agents…"
 *   onChange={(value) => setQuery(value)}
 * />
 * ```
 */
export const SearchBar: FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search',
  ariaLabel,
}) => {
  const resolvedAriaLabel = ariaLabel ?? placeholder;

  return (
    <div role="search">
      <div
        className={mergeClasses(
          styles.container,
          'flex cursor-text items-center gap-3 rounded-xl border px-[18px] py-[9px] transition-[border-color,box-shadow] duration-150 ease-in-out',
        )}
      >
        <IconSearch
          size={DIAL_ICON_SIZE.MD}
          className={mergeClasses(
            styles.icon,
            'shrink-0 transition-colors duration-150 ease-in-out',
          )}
          aria-hidden
        />
        <input
          type="search"
          className={mergeClasses(
            styles.input,
            'min-w-0 flex-1 border-0 p-0 text-sm font-normal leading-5 outline-none',
          )}
          value={value}
          placeholder={placeholder}
          aria-label={resolvedAriaLabel}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
};
