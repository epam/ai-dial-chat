import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { SearchBar } from '@epam/ai-dial-kit';
import { type FC, memo } from 'react';
import styles from '../SidebarPanel/SidebarPanel.module.scss';

/** Props for `SearchInput`. */
export interface SearchInputProps {
  /** Placeholder text (e.g. `"Search chat…"`). */
  placeholder: string;
  /** Current search query value. */
  value: string;
  /** Called whenever the query changes. */
  onChange: (value: string) => void;
}

/** Thin wrapper around `SearchBar` styled for use inside a sidebar panel. */
export const SearchInput: FC<SearchInputProps> = memo(
  ({ placeholder, value, onChange }) => (
    <div className={mergeClasses('mx-3 border-b pb-3', styles.divider)}>
      <SearchBar value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  ),
);
