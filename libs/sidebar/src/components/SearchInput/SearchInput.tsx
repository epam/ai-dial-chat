import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconSearch, IconX } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import panelStyles from '../SidebarPanel/SidebarPanel.module.scss';
import styles from './SearchInput.module.scss';

/** Props for `SearchInput`. */
export interface SearchInputProps {
  /** Placeholder text (e.g. `"Search chat…"`). */
  placeholder: string;
  /** Current search query value. */
  value: string;
  /** Called whenever the query changes. */
  onChange: (value: string) => void;
  /** CSS class applied to the search icon. Defaults to `'text-secondary'`. */
  iconClassName?: string;
}

/** Minimal search input with icon positioned to align with sibling action buttons. */
export const SearchInput: FC<SearchInputProps> = memo(
  ({ placeholder, value, onChange, iconClassName = 'text-secondary' }) => (
    <div
      className={mergeClasses('border-b px-2 py-1', panelStyles.divider)}
      data-cp-search-wrapper
    >
      <div
        className={mergeClasses(
          'flex h-9 w-full items-center gap-2 pe-3 ps-3',
          styles.row,
        )}
      >
        <IconSearch
          size={16}
          stroke={1.5}
          className={mergeClasses('shrink-0', iconClassName)}
        />
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={mergeClasses(
            'flex-1 bg-transparent outline-none',
            styles.input,
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className={mergeClasses('shrink-0', iconClassName)}
            aria-label="Clear search"
          >
            <IconX size={14} stroke={1.5} />
          </button>
        )}
      </div>
    </div>
  ),
);
