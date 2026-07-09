import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconSearch, IconX } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import styles from './SearchInput.module.scss';

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
  /** CSS class applied to the search icon. Defaults to `'text-secondary'`. */
  iconClassName?: string;
  /** CSS class applied to the outer wrapper, merged over the default `'px-2 py-1'`. Override to change the pill's horizontal inset. */
  wrapperClassName?: string;
  /** CSS class applied to the search row, merged after its own border/radius defaults. Use an important-modifier class (e.g. `'!rounded-lg'`) to override the default pill shape. */
  rowClassName?: string;
}

/** Minimal search input with icon positioned to align with sibling action buttons. */
export const SearchInput: FC<SearchInputProps> = memo(
  ({
    placeholder,
    value,
    onChange,
    clearLabel,
    iconClassName = 'text-secondary',
    wrapperClassName,
    rowClassName,
  }) => (
    <div className={mergeClasses('px-3 py-2', wrapperClassName)}>
      <div
        className={mergeClasses(
          'flex min-h-11 w-full items-center gap-2 rounded-full border pe-3 ps-3 desktop:min-h-9',
          styles.row,
          rowClassName,
        )}
      >
        <IconSearch
          size={DIAL_ICON_SIZE.SM}
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
            className={mergeClasses(
              'flex size-11 shrink-0 items-center justify-center desktop:size-6',
              iconClassName,
            )}
            aria-label={clearLabel}
          >
            <IconX size={14} stroke={1.5} />
          </button>
        )}
      </div>
    </div>
  ),
);
