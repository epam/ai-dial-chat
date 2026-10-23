import { FilterTab } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CONVERSATION_PANEL_CLASS } from '../../../constants/public-class-names';
import { ConversationTypeFilter } from '../../../types/conversation-kind';
import { ConversationListHeader } from '../ConversationListHeader';

interface MockMenuItem {
  key: string;
  label: React.ReactNode;
  renderItem?: (item: MockMenuItem) => React.ReactNode;
  checked?: boolean;
  onClick?: () => void;
  children?: MockMenuItem[];
}

/* Renders items flat; a row with children becomes a labelled submenu list. */
/* eslint-disable testing-library/no-node-access -- `children` is the menu item's own submenu field here, not a DOM node */
const MockMenu = ({
  items,
  label,
}: {
  items: MockMenuItem[];
  label: string;
}) => (
  <ul aria-label={label}>
    {items.map((item) => (
      <li key={item.key}>
        {item.children ? (
          <>
            <span role="menuitem">
              {item.renderItem ? item.renderItem(item) : item.label}
            </span>
            <MockMenu items={item.children} label={item.key} />
          </>
        ) : (
          <button
            role="menuitemradio"
            aria-checked={item.checked}
            onClick={item.onClick}
          >
            {item.label}
          </button>
        )}
      </li>
    ))}
  </ul>
);
/* eslint-enable testing-library/no-node-access */

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Small: 'small', Standard: 'standard', Large: 'large' },
  MenuItemMark: { Check: 'check' },
  GhostIconButton: React.forwardRef<
    HTMLButtonElement,
    {
      'aria-label'?: string;
      'aria-describedby'?: string;
      onClick?: () => void;
    }
  >(
    (
      { 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, onClick },
      ref,
    ) => (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onClick={onClick}
      />
    ),
  ),
  Dropdown: ({
    children,
    items,
  }: {
    children: React.ReactNode;
    items: MockMenuItem[];
  }) => (
    <>
      {children}
      <MockMenu items={items} label="filter menu" />
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
    personal: 'Personal',
    type: 'Type',
    origin: 'Origin',
    chat: 'Chat',
    task: 'Task',
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
  const [typeFilter, setTypeFilter] = useState(ConversationTypeFilter.All);

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
      activeTypeFilter={typeFilter}
      onTypeFilterChange={setTypeFilter}
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

  it('offers a Type and an Origin submenu, each showing its current value', () => {
    render(<Harness />);

    const [typeRow, originRow] = screen.getAllByRole('menuitem');
    expect(typeRow.textContent).toBe('TypeAll');
    expect(originRow.textContent).toBe('OriginAll');
  });

  it('marks the active origin and reports a new choice', () => {
    render(<Harness />);
    const origin = within(screen.getByRole('list', { name: 'filter-origin' }));

    expect(
      origin
        .getByRole('menuitemradio', { name: 'All' })
        .getAttribute('aria-checked'),
    ).toBe('true');

    fireEvent.click(origin.getByRole('menuitemradio', { name: 'Shared' }));

    expect(
      origin
        .getByRole('menuitemradio', { name: 'Shared' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getAllByRole('menuitem')[1].textContent).toBe('OriginShared');
  });

  it('names the My chats origin Personal', () => {
    render(<Harness />);

    expect(
      within(screen.getByRole('list', { name: 'filter-origin' })).getByRole(
        'menuitemradio',
        { name: 'Personal' },
      ),
    ).toBeTruthy();
  });

  it('marks the active type and reports a new choice', () => {
    render(<Harness />);
    const type = within(screen.getByRole('list', { name: 'filter-type' }));

    expect(
      type.getAllByRole('menuitemradio').map((option) => option.textContent),
    ).toEqual(['All', 'Chat', 'Task']);

    fireEvent.click(type.getByRole('menuitemradio', { name: 'Task' }));

    expect(
      type
        .getByRole('menuitemradio', { name: 'Task' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getAllByRole('menuitem')[0].textContent).toBe('TypeTask');
  });

  it('omits hidden sources from the origin submenu', () => {
    render(<Harness hiddenSources={[FilterTab.Organization]} />);
    const origin = within(screen.getByRole('list', { name: 'filter-origin' }));

    expect(
      origin.queryByRole('menuitemradio', { name: 'Organization' }),
    ).toBeNull();
    expect(origin.getByRole('menuitemradio', { name: 'Shared' })).toBeTruthy();
  });

  it('shows only the Origin submenu when no type handler is given', () => {
    render(
      <ConversationListHeader
        labels={LABELS}
        onFilterChange={vi.fn()}
        actions={<b>slot</b>}
      />,
    );

    expect(screen.queryByRole('list', { name: 'filter-type' })).toBeNull();
    expect(screen.getByRole('list', { name: 'filter-origin' })).toBeTruthy();
  });

  it('shows only the Type submenu when no origin handler is given', () => {
    render(
      <ConversationListHeader
        labels={LABELS}
        onTypeFilterChange={vi.fn()}
        actions={<b>slot</b>}
      />,
    );

    expect(screen.getByRole('list', { name: 'filter-type' })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'filter-origin' })).toBeNull();
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

  describe('applied-filter indicator', () => {
    it('describes nothing while every filter is All', () => {
      render(
        <ConversationListHeader labels={LABELS} onFilterChange={vi.fn()} />,
      );

      expect(
        screen.getByRole('button', { name: 'Filter chats', description: '' }),
      ).toBeTruthy();
    });

    it('describes the trigger as applied under an origin filter', () => {
      render(
        <ConversationListHeader
          labels={LABELS}
          activeFilter={FilterTab.Shared}
          onFilterChange={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: 'Filter chats',
          description: 'Filters applied',
        }),
      ).toBeTruthy();
    });

    it('describes the trigger with the host label under a type filter', () => {
      render(
        <ConversationListHeader
          labels={{ ...LABELS, filterActiveLabel: 'Filtered' }}
          activeTypeFilter={ConversationTypeFilter.Task}
          onTypeFilterChange={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: 'Filter chats',
          description: 'Filtered',
        }),
      ).toBeTruthy();
    });
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
