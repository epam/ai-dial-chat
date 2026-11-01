import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
  folderPathLabel: 'Project location',
  createProjectLabel: 'New project',
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
      labels={labels}
      locale="en"
      {...props}
    />
  );
};

/* Each card is an `<article>` named by its project; the folder path renders
 * a list of its own, so cards are found by role, not by list item. */
const cardNames = () =>
  screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'));

const getCard = (name: string) => screen.getByRole('article', { name });

const status = () => screen.getByRole('status');

describe('Projects', () => {
  it('renders the title as the page heading', () => {
    render(<Harness />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Projects' }),
    ).toBeTruthy();
  });

  it('lists every project with its source as the folder path', () => {
    render(<Harness />);

    const card = getCard('Handbook');
    expect(
      within(
        within(card).getByRole('navigation', { name: 'Project location' }),
      ).getByText('Organization'),
    ).toBeTruthy();
    expect(within(card).getByRole('time')).toBeTruthy();
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

  it('renders no New project button without onCreateProject', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'New project' })).toBeNull();
  });

  it('calls onCreateProject from the header New project button', async () => {
    const onCreateProject = vi.fn();
    render(<Harness onCreateProject={onCreateProject} />);

    const buttons = screen.getAllByRole('button', { name: 'New project' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);

    expect(onCreateProject).toHaveBeenCalledOnce();
  });

  it('adds a second New project button to the empty state', async () => {
    const onCreateProject = vi.fn();
    render(<Harness projects={[]} onCreateProject={onCreateProject} />);

    const buttons = screen.getAllByRole('button', { name: 'New project' });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);

    expect(onCreateProject).toHaveBeenCalledOnce();
  });

  it('keeps the empty-state button out of the no-results and error states', async () => {
    const { rerender } = render(
      <Harness hasError projects={[]} onCreateProject={vi.fn()} />,
    );
    expect(screen.getAllByRole('button', { name: 'New project' })).toHaveLength(
      1,
    );

    rerender(<Harness onCreateProject={vi.fn()} />);
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search projects' }),
      'zzz',
    );

    expect(screen.getAllByRole('button', { name: 'New project' })).toHaveLength(
      1,
    );
  });

  describe('Projects — pins and navigation', () => {
    it('marks a pinned card for assistive technology and lists it first', () => {
      render(
        <Harness
          projects={[
            ...projects,
            { ...projects[2], id: 'p4', name: 'Pinned one', isPinned: true },
          ]}
          labels={{ ...labels, pinnedLabel: 'Pinned' }}
        />,
      );

      expect(cardNames()[0]).toBe('Pinned one');
      expect(within(getCard('Pinned one')).getByText('Pinned')).toBeTruthy();
      expect(within(getCard('Handbook')).queryByText('Pinned')).toBeNull();
    });

    it('renders no link when the cards are not interactive', () => {
      render(<Harness />);

      expect(screen.queryByRole('link')).toBeNull();
    });

    it('opens a project on a plain click of its card link', async () => {
      const onOpenProject = vi.fn();
      render(
        <Harness
          onOpenProject={onOpenProject}
          getProjectHref={(id) => `/projects/view/${id}`}
        />,
      );

      const link = within(getCard('Handbook')).getByRole('link', {
        name: 'Handbook',
      });
      expect(link.getAttribute('href')).toBe('/projects/view/p2');
      await userEvent.click(link);

      expect(onOpenProject).toHaveBeenCalledWith('p2');
    });

    it('leaves a modified click to the browser', () => {
      const onOpenProject = vi.fn();
      render(
        <Harness
          onOpenProject={onOpenProject}
          getProjectHref={(id) => `/projects/view/${id}`}
        />,
      );

      const link = within(getCard('Handbook')).getByRole('link', {
        name: 'Handbook',
      });
      /* Records whether the card prevented the default, then stops jsdom,
       * which cannot navigate, from trying to follow the link. */
      let wasPrevented: boolean | undefined;
      const recordAndStop = (event: Event) => {
        wasPrevented = event.defaultPrevented;
        event.preventDefault();
      };
      document.addEventListener('click', recordAndStop);
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
        }),
      );
      document.removeEventListener('click', recordAndStop);

      expect(onOpenProject).not.toHaveBeenCalled();
      expect(wasPrevented).toBe(false);
    });
  });

  describe('Projects — relative times', () => {
    const MOUNTED_AT = Date.UTC(2026, 9, 30, 12, 0, 0);
    const TEN_MINUTES = 10 * 60 * 1000;
    const props = {
      onRetry: vi.fn(),
      searchQuery: '',
      onSearchQueryChange: vi.fn(),
      sortKey: ProjectsSortKey.Newest,
      onSortKeyChange: vi.fn(),
      labels,
      locale: 'en',
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reads now for a project the host updates while the page is open', () => {
      vi.useFakeTimers();
      vi.setSystemTime(MOUNTED_AT);
      const items: ProjectItem[] = [
        {
          id: 'p1',
          name: 'Q4 Launch',
          source: ProjectSource.Personal,
          updatedAt: MOUNTED_AT - TEN_MINUTES,
        },
      ];
      const { rerender } = render(<Projects {...props} projects={items} />);

      vi.setSystemTime(MOUNTED_AT + TEN_MINUTES);
      rerender(<Projects {...props} projects={items} />);
      expect(screen.getByText('10 minutes ago')).toBeTruthy();

      rerender(
        <Projects
          {...props}
          projects={[{ ...items[0], updatedAt: MOUNTED_AT + TEN_MINUTES }]}
        />,
      );
      expect(screen.getByText('now')).toBeTruthy();
    });
  });
});
