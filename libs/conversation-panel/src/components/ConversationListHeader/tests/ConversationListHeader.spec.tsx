import { FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { ConversationListHeader } from '../ConversationListHeader';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  MenuItemMark: { Check: 'check' },
  GhostIconButton: React.forwardRef<
    HTMLButtonElement,
    { 'aria-label'?: string; onClick?: () => void }
  >(({ 'aria-label': ariaLabel, onClick }, ref) => (
    <button ref={ref} aria-label={ariaLabel} onClick={onClick} />
  )),
  Dropdown: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: {
      key: string;
      label: React.ReactNode;
      checked?: boolean;
      onClick?: () => void;
    }[];
  }) => (
    <>
      {children}
      <ul aria-label="filter menu">
        {items.map((item) => (
          <li key={item.key}>
            <button
              role="menuitemradio"
              aria-checked={item.checked}
              onClick={item.onClick}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </>
  ),
  Search: ({
    value,
    onChange,
    placeholder,
    clearLabel,
    inputRef,
  }: {
    value?: string;
    onChange?: (value?: string) => void;
    placeholder?: string;
    clearLabel?: string;
    inputRef?: React.Ref<HTMLInputElement>;
  }) => (
    <div>
      <input
        ref={inputRef}
        type="search"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value || undefined)}
      />
      <button aria-label={clearLabel} onClick={() => onChange?.(undefined)} />
    </div>
  ),
}));

vi.mock('@epam/ai-dial-chat-shared', () => ({
  FilterTab: {
    All: 'all',
    Pinned: 'pinned',
    MyChats: 'my-chats',
    Shared: 'shared',
    Organization: 'organization',
  },
  mergeClasses: (...args: (string | undefined | false | null)[]) =>
    args.filter(Boolean).join(' '),
  buildCssVars: (vars: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(vars).filter(([, v]) => v != null)),
}));

vi.mock('@tabler/icons-react', () => ({
  IconChevronDown: () => <span>chevron-down</span>,
  IconChevronRight: () => <span>chevron-right</span>,
  IconFilter2: () => <span>filter</span>,
  IconSearch: () => <span>search</span>,
  IconX: () => <span>x</span>,
}));

const LABELS = {
  title: 'Chats and tasks',
  searchOpenLabel: 'Search chats',
  searchCloseLabel: 'Close search',
  searchPlaceholder: 'Search...',
  searchClearLabel: 'Clear search',
  filterLabels: {
    all: 'All',
    myChats: 'My chats',
    shared: 'Shared',
    organization: 'Organization',
  },
};

/** Owns the search state the way the app's view does. */
const Harness = ({
  onQueryChange,
  hiddenSources,
}: {
  onQueryChange?: (query: string) => void;
  hiddenSources?: FilterTab[];
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState(FilterTab.All);

  return (
    <ConversationListHeader
      labels={LABELS}
      searchQuery={query}
      isSearchOpen={isOpen}
      onSearchChange={(next) => {
        setQuery(next);
        onQueryChange?.(next);
      }}
      onSearchOpenChange={setIsOpen}
      activeFilter={filter}
      onFilterChange={setFilter}
      hiddenSources={hiddenSources}
      actions={<button>overflow</button>}
    />
  );
};

describe('ConversationListHeader', () => {
  it('renders the title and every control', () => {
    render(<Harness />);

    expect(screen.getByText('Chats and tasks')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search chats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Filter chats' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'overflow' })).toBeTruthy();
  });

  it('renders the title as plain text without a toggle handler', () => {
    render(<ConversationListHeader labels={LABELS} />);

    expect(
      screen.queryByRole('button', { name: /Chats and tasks/ }),
    ).toBeNull();
    expect(screen.getByText('Chats and tasks')).toBeTruthy();
  });

  it('reports the toggle through aria-expanded', () => {
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <ConversationListHeader
        labels={LABELS}
        isExpanded
        onToggleExpanded={onToggleExpanded}
      />,
    );

    const title = screen.getByRole('button', { name: /Chats and tasks/ });
    expect(title.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(title);
    expect(onToggleExpanded).toHaveBeenCalledOnce();

    rerender(
      <ConversationListHeader
        labels={LABELS}
        isExpanded={false}
        onToggleExpanded={onToggleExpanded}
      />,
    );
    expect(
      screen
        .getByRole('button', { name: /Chats and tasks/ })
        .getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('opens the search field with focus in it', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));

    const input = screen.getByRole('searchbox', { name: 'Search...' });
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no role-based query
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText('Chats and tasks')).toBeNull();
  });

  it('closes the search with its button, clears the query and returns focus', () => {
    const onQueryChange = vi.fn();
    render(<Harness onQueryChange={onQueryChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'plot' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(onQueryChange).toHaveBeenLastCalledWith('');
    expect(screen.getByText('Chats and tasks')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no role-based query
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Search chats' }),
    );
  });

  it('closes the search on Escape', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });

    expect(screen.getByText('Chats and tasks')).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('marks the active filter and reports a new choice', () => {
    render(<Harness />);

    expect(
      screen
        .getByRole('menuitemradio', { name: 'All' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Shared' }));

    expect(
      screen
        .getByRole('menuitemradio', { name: 'Shared' })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('omits hidden sources from the filter menu', () => {
    render(<Harness hiddenSources={[FilterTab.Organization]} />);

    expect(
      screen.queryByRole('menuitemradio', { name: 'Organization' }),
    ).toBeNull();
    expect(
      screen.getByRole('menuitemradio', { name: 'My chats' }),
    ).toBeTruthy();
  });

  it('omits the search and filter controls when their props are absent', () => {
    render(<ConversationListHeader labels={LABELS} actions={<b>slot</b>} />);

    expect(screen.queryByRole('button', { name: 'Search chats' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter chats' })).toBeNull();
    expect(screen.getByText('slot')).toBeTruthy();
  });

  it('exposes the title colors as custom properties on its root', () => {
    render(
      <ConversationListHeader
        labels={LABELS}
        styles={{ colors: { title: '#112233', titleFocus: '#445566' } }}
      />,
    );

    // eslint-disable-next-line testing-library/no-node-access -- the root carries no role; the custom properties sit on its inline style
    const root = screen.getByText('Chats and tasks').closest('div');
    expect(root?.style.getPropertyValue('--cp-list-header-title')).toBe(
      '#112233',
    );
    expect(root?.style.getPropertyValue('--cp-list-header-title-focus')).toBe(
      '#445566',
    );
  });
});

describe('ConversationListHeader — public class names', () => {
  it('stamps the header row', () => {
    render(
      <ConversationListHeader labels={LABELS} onToggleExpanded={vi.fn()} />,
    );

    /* The row has no role; it is found as the parent of its title button. */
    /* eslint-disable testing-library/no-node-access -- see above */
    const row = screen.getByRole('button', {
      name: /Chats and tasks/,
    }).parentElement;
    /* eslint-enable testing-library/no-node-access */

    expect(row?.classList).toContain(CONVERSATION_PANEL_CLASS.listHeader);
  });

  it('keeps the class on the row while it holds the search field', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Search chats' }));

    expect(screen.getByRole('search').classList).toContain(
      CONVERSATION_PANEL_CLASS.listHeader,
    );
  });
});

describe('ConversationListHeader — labels and typography', () => {
  it('names the filter trigger from filterLabels.groupAriaLabel', () => {
    render(
      <ConversationListHeader
        labels={{
          ...LABELS,
          filterLabels: { ...LABELS.filterLabels, groupAriaLabel: 'Show only' },
        }}
        onFilterChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Show only' })).toBeTruthy();
  });

  it('defaults the filter trigger name to "Filter chats"', () => {
    render(<ConversationListHeader labels={LABELS} onFilterChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Filter chats' })).toBeTruthy();
  });

  it('applies styles.typography.titleClassName to the title', () => {
    render(
      <ConversationListHeader
        labels={LABELS}
        styles={{ typography: { titleClassName: 'dial-tiny-semi-text' } }}
      />,
    );

    expect(screen.getByText('Chats and tasks').classList).toContain(
      'dial-tiny-semi-text',
    );
  });
});
