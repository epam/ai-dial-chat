import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconSearch } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from './SearchBar.module.scss';

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
}

/**
 * Catalog search bar.
 * The container carries all visual state (default / hover / focus-within);
 * the inner <input> stays transparent with no outline of its own.
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
