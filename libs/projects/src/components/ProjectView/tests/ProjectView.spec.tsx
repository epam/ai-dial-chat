import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ProjectViewLabels,
  ProjectViewModel,
  ProjectViewProps,
} from '../../../models/project-view-props';
import { ProjectView } from '../ProjectView';

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
  Spinner: () => <div role="progressbar" />,
}));

const labels: ProjectViewLabels = {
  backLabel: 'Back',
  pinLabel: 'Pin',
  publishLabel: 'Publish',
  editLabel: 'Edit',
  moreActionsLabel: 'More actions',
  shareLabel: 'Share',
  downloadLabel: 'Download',
  deleteLabel: 'Delete',
  detailsLabel: 'Details',
  descriptionLabel: 'Description',
  instructionsLabel: 'Instructions',
  contextLabel: 'Context',
  contextSearchPlaceholder: 'Search files',
  contextSearchAriaLabel: 'Search context files',
  clearSearchLabel: 'Clear search',
  contextResultCountLabel: (count) => `${count} files found`,
  emptyContextLabel: 'No context files',
  noContextMatchesLabel: 'No files match your search',
  openFileLabel: (name) => `Download ${name}`,
  errorLabel: 'Could not load the project',
  retryLabel: 'Retry',
  notFoundLabel: 'Project not found',
  browseProjectsLabel: 'Back to projects',
};

const project: ProjectViewModel = {
  name: 'Q4 launch',
  description: 'About Q4',
  instructions: '## Steps\n- one',
  contextFiles: [
    { name: 'tickets.csv', contentType: 'text/csv' },
    {
      name: 'survey.xlsx',
      contentType: 'application/vnd.ms-excel',
    },
    { name: 'ticket-archive.pdf', contentType: 'application/pdf' },
  ],
};

const baseProps = (): ProjectViewProps => ({
  project,
  isPinned: false,
  contextSearchQuery: '',
  onContextSearchQueryChange: vi.fn(),
  onBack: vi.fn(),
  onTogglePin: vi.fn(),
  onPublish: vi.fn(),
  onEdit: vi.fn(),
  onShare: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onOpenFile: vi.fn(),
  onRetry: vi.fn(),
  onBrowseProjects: vi.fn(),
  labels,
});

const renderView = (props: Partial<ProjectViewProps> = {}) => {
  const merged = { ...baseProps(), ...props };
  render(<ProjectView {...merged} />);
  return merged;
};

/* A controlled host for the context search, as the app page provides. */
const SearchHost = (props: Partial<ProjectViewProps>) => {
  const [query, setQuery] = useState('');
  return (
    <ProjectView
      {...baseProps()}
      {...props}
      contextSearchQuery={query}
      onContextSearchQueryChange={setQuery}
    />
  );
};

describe('ProjectView', () => {
  it('renders the name as the page heading, the description and markdown instructions', () => {
    renderView();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Q4 launch' }),
    ).toBeTruthy();
    expect(screen.getByText('About Q4')).toBeTruthy();
    const details = screen.getByRole('complementary', { name: 'Details' });
    expect(
      within(details).getByRole('heading', { name: 'Steps' }),
    ).toBeTruthy();
    expect(within(details).getByText('one', { selector: 'li' })).toBeTruthy();
  });

  it('omits the empty description and instructions sections', () => {
    renderView({ project: { ...project, description: '', instructions: '' } });

    expect(screen.queryByRole('heading', { name: 'Description' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Instructions' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Context' })).toBeTruthy();
  });

  it('frames the Details panel with an inline-start border and the design typography', () => {
    renderView();

    const details = screen.getByRole('complementary', { name: 'Details' });
    const heading = within(details).getByRole('heading', {
      level: 2,
      name: 'Details',
    });
    expect(details.className).toContain('desktop:border-s');
    expect(details.className).not.toContain('rounded');
    expect(heading.className).toContain('dial-body-semi-text');
    expect(
      within(details).getByRole('heading', { level: 3, name: 'Description' })
        .className,
    ).toContain('dial-tiny-text');
    expect(within(details).getByText('About Q4').className).toContain(
      'dial-small-text',
    );
  });

  it('shows no capacity meter for the context', () => {
    renderView();

    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('calls onOpenFile with the name of the activated context card', async () => {
    const { onOpenFile } = renderView();

    await userEvent.click(
      screen.getByRole('button', { name: 'Download tickets.csv' }),
    );

    expect(onOpenFile).toHaveBeenCalledWith('tickets.csv');
  });

  it('filters the context files and announces the match count', async () => {
    render(<SearchHost />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search context files' }),
      'ticket',
    );

    expect(
      screen.getByRole('button', { name: 'Download tickets.csv' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Download ticket-archive.pdf' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Download survey.xlsx' }),
    ).toBeNull();
    /* Each attachment card keeps its own (empty) error status region mounted. */
    expect(
      screen.getAllByRole('status').map((status) => status.textContent),
    ).toContain('2 files found');
  });

  it('shows the no-matches message when the query matches no file', async () => {
    render(<SearchHost />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search context files' }),
      'zzz',
    );

    expect(screen.getByText('No files match your search')).toBeTruthy();
  });

  it('labels a context file with no known MIME type by its own extension', () => {
    renderView({
      project: {
        ...project,
        contextFiles: [{ name: 'survey.xlsx', contentType: '' }],
      },
    });

    expect(screen.getByText('.xlsx')).toBeTruthy();
    expect(screen.queryByText('.bin')).toBeNull();
  });

  it('shows the empty context state without a search input', () => {
    renderView({ project: { ...project, contextFiles: [] } });

    expect(screen.getByText('No context files')).toBeTruthy();
    expect(screen.queryByRole('search')).toBeNull();
  });

  it('exposes the pin state through aria-pressed and calls onTogglePin', async () => {
    const { onTogglePin } = renderView();

    const pin = screen.getByRole('button', { name: 'Pin' });
    expect(pin.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(pin);

    expect(onTogglePin).toHaveBeenCalledOnce();
  });

  it('keeps the toggle name stable and reports the pinned state as pressed', () => {
    renderView({ isPinned: true });

    expect(
      screen.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('keeps the toggle focusable and ignores it while a pin change is pending', async () => {
    const { onTogglePin } = renderView({ isPinPending: true });

    const pin = screen.getByRole('button', { name: 'Pin' });
    expect(pin.hasAttribute('disabled')).toBe(false);
    expect(pin.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(pin);

    expect(onTogglePin).not.toHaveBeenCalled();
  });

  it('leads the mobile more-actions menu with Publish and Edit', async () => {
    renderView();

    const [desktopTrigger, mobileTrigger] = screen.getAllByRole('button', {
      name: 'More actions',
    });
    // eslint-disable-next-line testing-library/no-node-access -- the breakpoint is a class on the trigger's wrapper, which has no role
    expect(desktopTrigger.closest('[class~="desktop:block"]')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- see above
    expect(mobileTrigger.closest('[class~="desktop:hidden"]')).toBeTruthy();

    await userEvent.click(mobileTrigger);
    const items = within(await screen.findByRole('menu')).getAllByRole(
      'menuitem',
    );

    expect(items.map((item) => item.textContent)).toEqual([
      'Publish',
      'Edit',
      'Share',
      'Download',
      'Delete',
    ]);
  });

  it('renders instruction headings on the panel scale, not the page scale', () => {
    renderView();

    const heading = screen.getByRole('heading', { name: 'Steps' });
    expect(heading.className).toContain('dial-small-semi-text');
    expect(heading.className).not.toContain('dial-h2-text');
  });

  it('calls onBack from the back button', async () => {
    const { onBack } = renderView();

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('offers Share, Download and Delete in the more-actions menu', async () => {
    const { onDownload } = renderView();

    await userEvent.click(
      screen.getAllByRole('button', { name: 'More actions' })[0],
    );
    const menu = await screen.findByRole('menu');

    expect(within(menu).getByRole('menuitem', { name: 'Share' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeTruthy();
    await userEvent.click(
      within(menu).getByRole('menuitem', { name: 'Download' }),
    );
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('hides Publish, Edit, Share and Delete when their callbacks are omitted', async () => {
    renderView({
      onPublish: undefined,
      onEdit: undefined,
      onShare: undefined,
      onDelete: undefined,
    });

    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    for (const trigger of screen.getAllByRole('button', {
      name: 'More actions',
    })) {
      await userEvent.click(trigger);
      const menu = await screen.findByRole('menu');
      expect(
        within(menu).queryByRole('menuitem', { name: 'Share' }),
      ).toBeNull();
      expect(
        within(menu).queryByRole('menuitem', { name: 'Delete' }),
      ).toBeNull();
      expect(
        within(menu).queryByRole('menuitem', { name: 'Publish' }),
      ).toBeNull();
      expect(
        within(menu).getByRole('menuitem', { name: 'Download' }),
      ).toBeTruthy();
      await userEvent.keyboard('{Escape}');
    }
    expect(screen.getByRole('button', { name: 'Pin' })).toBeTruthy();
  });

  it('mirrors the back arrow in RTL', () => {
    renderView();

    const backButton = screen.getByRole('button', { name: 'Back' });
    // eslint-disable-next-line testing-library/no-node-access -- the mirroring is a class on the aria-hidden icon, which has no role
    const icon = backButton.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('rtl:scale-x-[-1]');
  });

  it('shows the loading state', () => {
    renderView({ project: null, isLoading: true });

    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
  });

  it('shows the error state with a retry action', async () => {
    const { onRetry } = renderView({ project: null, hasError: true });

    expect(screen.getByRole('alert').textContent).toBe(
      'Could not load the project',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the not-found state with a way back to the list', async () => {
    const { onBrowseProjects } = renderView({
      project: null,
      isNotFound: true,
    });

    expect(screen.getByRole('alert').textContent).toBe('Project not found');
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to projects' }),
    );
    expect(onBrowseProjects).toHaveBeenCalledOnce();
  });
});
