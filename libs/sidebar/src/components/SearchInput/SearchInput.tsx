import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialSearch } from '@epam/ai-dial-ui-kit';
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

/** Thin wrapper around `DialSearch` styled for use inside a sidebar panel. */
export const SearchInput: FC<SearchInputProps> = memo(
  ({ placeholder, value, onChange }) => (
    <div className={mergeClasses('border-b', styles.divider)}>
      <DialSearch
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        wrapperClassName="border-0 ps-5 [&>div]:border-0 [&>div]:button:bg-transparent"
      />
    </div>
  ),
);
