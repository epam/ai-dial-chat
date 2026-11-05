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
  Spinner: ({ ariaLabel }: { ariaLabel?: string }) => (
    <div role="progressbar" aria-label={ariaLabel} />
  ),
}));

const labels: ProjectViewLabels = {
  backLabel: 'Back',
  pinLabel: 'Pin',
  unpinLabel: 'Unpin',
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
  openFileLabel: (name) => `Preview ${name}`,
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
  onContextFileClick: vi.fn(),
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

  it('calls onContextFileClick with the name of the activated context card', async () => {
    const { onContextFileClick } = renderView();

    await userEvent.click(
      screen.getByRole('button', { name: 'Preview tickets.csv' }),
    );

    expect(onContextFileClick).toHaveBeenCalledWith('tickets.csv');
  });

  it('renders only the card named by selectedContextFileId as selected', () => {
    renderView({ selectedContextFileId: 'tickets.csv' });

    expect(
      screen
        .getByRole('button', { name: 'Preview tickets.csv' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Preview survey.xlsx' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('renders no card as selected when selectedContextFileId is unset', () => {
    renderView();

    expect(screen.queryByRole('button', { pressed: true })).toBeNull();
  });

  it('filters the context files and announces the match count', async () => {
    render(<SearchHost />);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search context files' }),
      'ticket',
    );

    expect(
      screen.getByRole('button', { name: 'Preview tickets.csv' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Preview ticket-archive.pdf' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Preview survey.xlsx' }),
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

  it('shows Pin on an unpinned project and calls onTogglePin', async () => {
    const { onTogglePin } = renderView();

    const pin = screen.getByRole('button', { name: 'Pin' });
    expect(pin.hasAttribute('aria-pressed')).toBe(false);
    await userEvent.click(pin);

    expect(onTogglePin).toHaveBeenCalledOnce();
  });

  it('shows Unpin on a pinned project', () => {
    renderView({ isPinned: true });

    expect(screen.getByRole('button', { name: 'Unpin' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
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
      'Pin',
      'Publish',
      'Edit',
      'Share',
      'Download',
      'Delete',
    ]);
  });

  it('opens the more-actions menu as a bottom sheet on a phone', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    try {
      const onEdit = vi.fn();
      renderView({ onEdit });

      const [, mobileTrigger] = screen.getAllByRole('button', {
        name: 'More actions',
      });
      await userEvent.click(mobileTrigger);

      const sheet = await screen.findByRole('dialog', {
        name: 'Q4 launch',
      });
      await userEvent.click(
        within(sheet).getByRole('menuitem', { name: 'Edit' }),
      );
      expect(onEdit).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('renders instruction headings on the panel scale, not the page scale', () => {
    renderView();

    const heading = screen.getByRole('heading', { name: 'Steps' });
    expect(heading.className).toContain('dial-small-semi-text');
    expect(heading.className).not.toContain('dial-h1-text');
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

    expect(
      screen.getByRole('progressbar', { name: 'Loading project' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pin' })).toBeNull();
  });

  it('announces the load failure through the status region mounted while loading', async () => {
    const props = { ...baseProps(), project: null };
    const { rerender } = render(<ProjectView {...props} isLoading />);
    /* The Spinner is an empty status of its own, so keep every empty region seen while loading. */
    const emptyRegions = screen
      .getAllByRole('status')
      .filter((node) => node.textContent === '');

    rerender(<ProjectView {...props} hasError />);
    const { onRetry } = props;

    expect(
      emptyRegions.some(
        (node) =>
          node.isConnected && node.textContent === 'Could not load the project',
      ),
    ).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the not-found state with a way back to the list', async () => {
    const { onBrowseProjects } = renderView({
      project: null,
      isNotFound: true,
    });

    expect(screen.getByText('Project not found').hasAttribute('role')).toBe(
      false,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to projects' }),
    );
    expect(onBrowseProjects).toHaveBeenCalledOnce();
  });

  it('renders the main column before the Details panel, named by its label', () => {
    renderView({
      mainContent: <p>Chats go here</p>,
      mainContentLabel: 'Project chats',
    });

    const main = screen.getByRole('region', { name: 'Project chats' });
    const details = screen.getByRole('complementary');
    expect(main.textContent).toContain('Chats go here');
    expect(
      main.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('places the Details panel beside the main column on desktop by default', () => {
    renderView({ mainContent: <p>Chats go here</p> });

    const details = screen.getByRole('complementary');
    expect(details.className).toContain('desktop:w-[488px]');
    expect(details.className).toContain('desktop:border-s');
    expect(details.parentElement?.className).toContain('desktop:flex-row');
  });

  it('stacks the Details panel below the main column on desktop when isDetailsStacked is set', () => {
    renderView({ mainContent: <p>Chats go here</p>, isDetailsStacked: true });

    const details = screen.getByRole('complementary');
    expect(details.className).not.toContain('desktop:w-[488px]');
    expect(details.className).not.toContain('desktop:border-s');
    expect(details.className).toContain('border-t');
    expect(details.parentElement?.className).not.toContain('desktop:flex-row');
    expect(
      within(details).getByRole('button', { name: 'Preview tickets.csv' }),
    ).toBeTruthy();
  });

  it('uses no physical-direction utility and no fixed width below desktop on the stacked Details panel', () => {
    renderView({ mainContent: <p>Chats go here</p>, isDetailsStacked: true });

    const classes = screen.getByRole('complementary').className.split(/\s+/);
    const physical = classes.filter((name) =>
      /^(?:[a-z_]+:)*(?:-?m[lr]|p[lr]|left|right|border-[lr]|text-(?:left|right)|rounded-[lr]|rounded-t[lr]|rounded-b[lr])(?:-|$)/.test(
        name,
      ),
    );
    const fixedWidthBelowDesktop = classes.filter((name) => /^w-\[/.test(name));
    expect(physical).toEqual([]);
    expect(fixedWidthBelowDesktop).toEqual([]);
    expect(classes).toContain('w-full');
  });

  it('keeps the Details panel readable in RTL when stacked', () => {
    document.documentElement.dir = 'rtl';
    try {
      renderView({ mainContent: <p>Chats go here</p>, isDetailsStacked: true });

      const details = screen.getByRole('complementary');
      expect(details.className).toContain('border-t');
      expect(details.className).not.toContain('desktop:border-s');
    } finally {
      document.documentElement.dir = '';
    }
  });

  it('does not bottom-align a stacked Details panel when there is no main column', () => {
    renderView({ isDetailsStacked: true });

    const details = screen.getByRole('complementary');
    expect(details.parentElement?.className).not.toContain(
      'desktop:justify-end',
    );
  });

  it('keeps pushing the Details panel to the inline end without a main column', () => {
    renderView();

    const details = screen.getByRole('complementary');
    expect(details.parentElement?.className).toContain('desktop:justify-end');
  });

  it('omits the main column when no content is given', () => {
    renderView();

    expect(
      screen.queryByRole('region', { name: 'Project content' }),
    ).toBeNull();
  });
});
