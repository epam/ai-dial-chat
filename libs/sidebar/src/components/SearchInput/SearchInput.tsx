import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchBar } from '@epam/ai-dial-kit';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { type FC, memo, useMemo } from 'react';
import styles from './SearchInput.module.scss';

/** CSS custom-property overrides for the `SearchInput` component. */
export interface SearchInputColors {
  /** Search icon color. */
  icon?: string;
}

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
  /** Accessible label for the search input. Defaults to `placeholder` when omitted. */
  ariaLabel?: string;
  /** CSS class applied to the search icon. Defaults to the module's `.icon` class (`--text-secondary`). */
  iconClassName?: string;
  /** CSS class applied to the outer wrapper, merged over the default `'px-2 py-1'`. Override to change the pill's horizontal inset. */
  wrapperClassName?: string;
  /** CSS class applied to the search row, merged after its own border/radius defaults. Use an important-modifier class (e.g. `'!rounded-lg'`) to override the default pill shape. */
  rowClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: SearchInputColors;
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
    ariaLabel,
    iconClassName = styles.icon,
    wrapperClassName,
    rowClassName,
    colors,
  }) => {
    const searchCssVars = useMemo(
      () =>
        buildCssVars({
          '--si-icon': colors?.icon,
        }),
      [colors],
    );

    return (
      <div
        className={mergeClasses('px-3 py-2', wrapperClassName)}
        style={searchCssVars}
      >
        <SearchBar
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          clearLabel={clearLabel}
          ariaLabel={ariaLabel}
          iconClassName={iconClassName}
          iconSize={DIAL_ICON_SIZE.SM}
          iconStrokeWidth={1.5}
          containerClassName={mergeClasses(
            'min-h-11 w-full gap-2 rounded-full border pe-3 ps-3 desktop:min-h-9',
            rowClassName,
          )}
          clearButtonClassName="size-11 desktop:size-6"
        />
      </div>
    );
  },
);
