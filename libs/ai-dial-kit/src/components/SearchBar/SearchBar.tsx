import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconSearch, IconX } from '@tabler/icons-react';
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
  /** Extra CSS class applied to the inner container div (border, background, radius, shadow). */
  containerClassName?: string;
  /** Extra CSS class applied to the search and clear icons. */
  iconClassName?: string;
  /** Extra CSS class applied to the `<input>` element. */
  inputClassName?: string;
  /** Size (px) of the search and clear icons. Defaults to `DIAL_ICON_SIZE.MD`. */
  iconSize?: number;
  /** Stroke width of the search and clear icons. Defaults to the icon's own default. */
  iconStrokeWidth?: number;
  /** Accessible label for the clear button. When provided, a clear (X) button is shown once `value` is non-empty. */
  clearLabel?: string;
  /** Extra CSS class applied to the clear button. */
  clearButtonClassName?: string;
}

/** Search input with leading icon, optional clear button, hover/focus border, and aria-label fallback to placeholder. */
export const SearchBar: FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Search',
  ariaLabel,
  containerClassName,
  iconClassName,
  inputClassName,
  iconSize = DIAL_ICON_SIZE.MD,
  iconStrokeWidth,
  clearLabel = 'Clear search',
  clearButtonClassName,
}) => {
  const resolvedAriaLabel = ariaLabel ?? placeholder;

  return (
    <div role="search">
      <div
        className={mergeClasses(
          styles.container,
          'flex cursor-text items-center gap-3 rounded-xl border px-4 py-2 transition-[border-color,box-shadow] duration-150 ease-in-out',
          containerClassName,
        )}
      >
        <IconSearch
          size={iconSize}
          stroke={iconStrokeWidth}
          className={mergeClasses(
            styles.icon,
            'shrink-0 transition-colors duration-150 ease-in-out',
            iconClassName,
          )}
          aria-hidden
        />
        <input
          type="text"
          className={mergeClasses(
            styles.input,
            'min-w-0 flex-1 border-0 p-0 text-sm font-normal leading-5 outline-none',
            inputClassName,
          )}
          value={value}
          placeholder={placeholder}
          aria-label={resolvedAriaLabel}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={clearLabel}
            className={mergeClasses(
              'flex shrink-0 items-center justify-center',
              clearButtonClassName,
            )}
          >
            <IconX
              size={iconSize}
              stroke={iconStrokeWidth}
              className={mergeClasses(styles.icon, iconClassName)}
              aria-hidden
            />
          </button>
        )}
      </div>
    </div>
  );
};
