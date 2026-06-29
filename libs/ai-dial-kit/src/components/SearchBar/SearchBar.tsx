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
      <div className={styles.container}>
        <IconSearch
          size={DIAL_ICON_SIZE.MD}
          className={styles.icon}
          aria-hidden
        />
        <input
          type="search"
          className={styles.input}
          value={value}
          placeholder={placeholder}
          aria-label={resolvedAriaLabel}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
};
