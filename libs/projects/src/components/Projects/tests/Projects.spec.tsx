import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectItem } from '../../../models/project-item';
import type {
  ProjectsLabels,
  ProjectsProps,
} from '../../../models/projects-props';
import { ProjectSource } from '../../../types/project-source';
import { ProjectsSortKey } from '../../../types/projects-sort-key';
import { Projects } from '../Projects';

vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-ui-kit')>()),
  Search: ({
    value,
    onChange,
    placeholder,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    onChange?: (v?: string) => void;
    placeholder?: string;
    'aria-label'?: string;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Highlight: ({ text, query }: { text: string; query?: string }) => {
    const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    if (index < 0 || !query) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </span>
    );
  },
  Spinner: () => <div role="progressbar" />,
  /* ButtonDropdown is deliberately NOT mocked: choosing an order through the
     real menu is the behaviour under test. */
}));

const labels: ProjectsLabels = {
  title: 'Projects',
  subtitle: 'All projects available to you',
  searchPlaceholder: 'Search projects',
  searchAriaLabel: 'Search projects',
  clearSearchLabel: 'Clear search',
  sortLabel: 'Sort',
  sortOptions: [
    { value: ProjectsSortKey.Newest, label: 'Newest' },
    { value: ProjectsSortKey.Oldest, label: 'Oldest' },
    { value: ProjectsSortKey.NameAsc, label: 'Name A–Z' },
  ],
  emptyStateLabel: 'No projects yet',
  emptyStateDescription: 'Your projects will appear here once created.',
  noResultsLabel: 'No matching projects',
  errorLabel: 'Projects could not be loaded',
  incompleteLabel: 'Some projects could not be loaded',
  retryLabel: 'Retry',
  sourceLabels: {
    [ProjectSource.Personal]: 'Personal',
    [ProjectSource.Shared]: 'Shared',
    [ProjectSource.Organization]: 'Organization',
  },
  resultCountLabel: (count) => `${count} projects`,
};

const projects: ProjectItem[] = [
  {
    id: 'p1',
    name: 'Q4 Launch',
    source: ProjectSource.Personal,
    updatedAt: Date.UTC(2026, 0, 1),
  },
  {
    id: 'p2',
    name: 'Handbook',
    source: ProjectSource.Organization,
    updatedAt: Date.UTC(2026, 2, 1),
  },
  { id: 'p3', name: 'Launch retro', source: ProjectSource.Shared },
];

const formatUpdatedAt = (timestamp: number) =>
  `Updated ${new Date(timestamp).toISOString().slice(0, 10)}`;

const Harness = (props: Partial<ProjectsProps>) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState(ProjectsSortKey.Newest);
  return (
    <Projects
      projects={projects}
      onRetry={vi.fn()}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      sortKey={sortKey}
      onSortKeyChange={setSortKey}
      formatUpdatedAt={formatUpdatedAt}
      labels={labels}
      locale="en"
      {...props}
    />
  );
};

/* A highlighted name is split by <mark>, so match the element's full text. */
const byFullText = (text: string) => (_: string, element: Element | null) =>
  element?.textContent === text;

const cardNames = () =>
  within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map(
      (item) =>
        projects.find(
          ({ name }) => within(item).queryByText(byFullText(name)) != null,
        )?.name,
    );

const getCard = (name: string) =>
  screen
    .getAllByRole('listitem')
    .find(
      (item) => within(item).queryByText(byFullText(name)) != null,
    ) as HTMLElement;

const status = () => screen.getByRole('status');

describe('Projects', () => {
  it('renders the title as the page heading', () => {
    render(<Harness />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Projects' }),
    ).toBeTruthy();
  });

  it('lists every project with its source label and formatted date', () => {
    render(<Harness />);

    const card = getCard('Handbook');
    expect(within(card).getByText('Organization')).toBeTruthy();
    const date = within(card).getByText('Updated 2026-03-01');
    expect(date.tagName).toBe('TIME');
    expect(date.getAttribute('dateTime')).toBe('2026-03-01T00:00:00.000Z');
  });

  it('omits the date line for an undated project', () => {
    render(<Harness />);

    const card = getCard('Launch retro');
    expect(within(card).queryByText(/^Updated/)).toBeNull();
  });

  it('orders projects by Newest by default with undated projects last', () => {
    render(<Harness />);

    expect(cardNames()).toEqual(['Handbook', 'Q4 Launch', 'Launch retro']);
    expect(screen.getByRole('button', { name: 'Newest' })).toBeTruthy();
  });

  it('reorders the list when Oldest is chosen from the sort menu', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Newest' }));
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Oldest' }),
    );

    expect(cardNames()).toEqual(['Q4 Launch', 'Handbook', 'Launch retro']);
  });

  it('reorders the list when Name A–Z is chosen from the sort menu', async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole('button', { name: 'Newest' }));
    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Name A–Z' }),
    );

    expect(cardNames()).toEqual(['Handbook', 'Launch retro', 'Q4 Launch']);
  });

  it('places the sort control in a group named after the sort label', () => {
    render(<Harness />);

    const group = screen.getByRole('group', { name: 'Sort' });
    expect(within(group).getByRole('button', { name: 'Newest' })).toBeTruthy();
  });

  it('filters by name and highlights the match', async () => {
    render(<Harness />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search projects' }),
      'launch',
    );

    expect(cardNames()).toEqual(['Q4 Launch', 'Launch retro']);
    for (const name of ['Q4 Launch', 'Launch retro']) {
      expect(
        within(getCard(name)).getByText('Launch', { selector: 'mark' }),
      ).toBeTruthy();
    }
    expect(status().textContent).toBe('2 projects');
  });

  it('keeps the search input inside a search landmark', () => {
    render(<Harness />);

    expect(
      within(screen.getByRole('search')).getByRole('textbox', {
        name: 'Search projects',
      }),
    ).toBeTruthy();
  });

  it('announces the result count through the status region', () => {
    render(<Harness />);

    expect(status().getAttribute('aria-live')).toBe('polite');
    expect(status().textContent).toBe('3 projects');
  });

  it('shows and announces the no-results state when nothing matches', async () => {
    render(<Harness />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search projects' }),
      'zzz',
    );

    expect(screen.queryByRole('list')).toBeNull();
    expect(
      screen.getByText('No matching projects', {
        selector: ':not([role="status"])',
      }),
    ).toBeTruthy();
    expect(screen.queryByText('No projects yet')).toBeNull();
    expect(status().textContent).toBe('No matching projects');
  });

  it('shows the empty state when there are no projects', () => {
    render(<Harness projects={[]} />);

    expect(
      screen.getByText('Your projects will appear here once created.'),
    ).toBeTruthy();
    expect(status().textContent).toBe('No projects yet');
  });

  it('shows a spinner and announces nothing while loading', () => {
    render(<Harness isLoading />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(status().textContent).toBe('');
  });

  it('shows the error state and calls onRetry from the retry action', async () => {
    const onRetry = vi.fn();
    render(<Harness hasError onRetry={onRetry} />);

    expect(screen.queryByRole('list')).toBeNull();
    expect(status().textContent).toBe('Projects could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows a retry notice above the list when a source is incomplete', async () => {
    const onRetry = vi.fn();
    render(
      <Harness
        incompleteSources={[ProjectSource.Organization]}
        onRetry={onRetry}
      />,
    );

    expect(cardNames()).toEqual(['Handbook', 'Q4 Launch', 'Launch retro']);
    expect(
      screen.getByText('Some projects could not be loaded', {
        selector: 'p',
      }),
    ).toBeTruthy();
    expect(status().textContent).toBe('Some projects could not be loaded');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the incomplete notice instead of the empty state when nothing could be listed', () => {
    render(
      <Harness projects={[]} incompleteSources={[ProjectSource.Personal]} />,
    );

    expect(screen.queryByText('No projects yet')).toBeNull();
    expect(
      screen.queryByText('Your projects will appear here once created.'),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(status().textContent).toBe('Some projects could not be loaded');
  });

  it('renders no New project action', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: /new project/i })).toBeNull();
  });
});
