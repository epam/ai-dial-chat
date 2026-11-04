import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectConversationListLabels,
  ProjectConversationListProps,
} from '../../../models/project-conversation-list-props';
import { ProjectConversationList } from '../ProjectConversationList';

const labels: ProjectConversationListLabels = {
  title: 'Chats',
  openLabel: (title, author) => (author ? `${title}, by ${author}` : title),
  moreActionsLabel: (title) => `More actions for ${title}`,
  renameLabel: 'Rename',
  deleteLabel: 'Delete',
  loadingLabel: 'Loading chats',
  errorLabel: 'Could not load the chats',
  retryLabel: 'Retry',
  emptyTitle: 'No outputs or chats yet',
  emptyDescription: 'Your outputs and chats will appear here once started.',
};

const items = [
  { id: 'c1', title: 'Weekly summary', authorName: 'Valery Tester' },
  { id: 'c2', title: 'Login article' },
];

const renderList = (props: Partial<ProjectConversationListProps> = {}) => {
  const callbacks = {
    onRetry: vi.fn(),
    onOpen: vi.fn(),
  };
  render(
    <ProjectConversationList
      items={items}
      labels={labels}
      {...callbacks}
      {...props}
    />,
  );
  return callbacks;
};

describe('ProjectConversationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.dir = 'ltr';
  });

  it('renders the trailing node of an item inside its row button', () => {
    renderList({
      items: [
        {
          id: 'c1',
          title: 'Weekly summary',
          isUnread: true,
          leading: <b>Avatar</b>,
          trailing: <i>Badge</i>,
        },
      ],
    });

    const row = screen.getByRole('button', { name: /Weekly summary/ });
    expect(within(row).getByText('Badge')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-node-access -- the dot is a decorative span with no role
    expect(row.querySelector('[class*="unreadDot"]')).toBeNull();
  });

  it('draws the unread dot at the end of the row when a leading node replaces the status point', () => {
    renderList({
      items: [
        {
          id: 'c1',
          title: 'Weekly summary',
          isUnread: true,
          leading: <b>A</b>,
        },
      ],
    });

    const row = screen.getByRole('button', { name: /Weekly summary/ });
    // eslint-disable-next-line testing-library/no-node-access -- the dot is a decorative span with no role
    expect(row.querySelectorAll('[class*="unreadDot"]')).toHaveLength(1);
    expect(row.lastElementChild?.className).toContain('size-6');
  });

  it('renders the leading node of an item inside its row button', () => {
    renderList({
      items: [{ id: 'c1', title: 'Weekly summary', leading: <b>Avatar</b> }],
    });

    const row = screen.getByRole('button', { name: /Weekly summary/ });
    expect(within(row).getByText('Avatar')).toBeTruthy();
  });

  it('names the section by its heading and each row by its title and author', () => {
    renderList();

    const section = screen.getByRole('region', { name: 'Chats' });
    expect(
      within(section).getByRole('button', {
        name: 'Weekly summary, by Valery Tester',
      }),
    ).toBeTruthy();
    expect(
      within(section).getByRole('button', { name: 'Login article' }),
    ).toBeTruthy();
  });

  it('opens a row on click and on Enter', async () => {
    const { onOpen } = renderList();

    await userEvent.click(
      screen.getByRole('button', { name: 'Login article' }),
    );
    screen
      .getByRole('button', { name: 'Weekly summary, by Valery Tester' })
      .focus();
    await userEvent.keyboard('{Enter}');

    expect(onOpen).toHaveBeenNthCalledWith(1, 'c2');
    expect(onOpen).toHaveBeenNthCalledWith(2, 'c1');
  });

  it('has no row menu when read-only', () => {
    renderList();

    expect(
      screen.queryByRole('button', { name: /More actions for/ }),
    ).toBeNull();
  });

  it('offers Rename and Delete from the row menu', async () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    renderList({ onRename, onDelete });

    await userEvent.click(
      screen.getByRole('button', { name: 'More actions for Login article' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Rename' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'More actions for Login article' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Delete' }),
    );

    expect(onRename).toHaveBeenCalledWith('c2');
    expect(onDelete).toHaveBeenCalledWith('c2');
  });

  it('renders nothing while empty when the empty state is not shown', () => {
    renderList({ items: [], isEmptyStateShown: false });

    expect(screen.queryByText('No outputs or chats yet')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the empty state in a status region', () => {
    renderList({ items: [] });

    const status = screen.getByRole('status');
    expect(within(status).getByText('No outputs or chats yet')).toBeTruthy();
    expect(
      within(status).getByText(
        'Your outputs and chats will appear here once started.',
      ),
    ).toBeTruthy();
  });

  it('hides the Chats heading while the project has no chats and keeps the region named', () => {
    renderList({ items: [] });

    expect(screen.queryByRole('heading', { name: 'Chats' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Chats' })).toBeTruthy();
  });

  it('shows the error state with a retry action', async () => {
    const { onRetry } = renderList({ hasError: true });

    expect(
      within(screen.getByRole('status')).getByText('Could not load the chats'),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('offers See more only while more exist and a handler is given', async () => {
    const onLoadMore = vi.fn();
    const { rerender } = render(
      <ProjectConversationList
        items={items}
        labels={labels}
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onLoadMore={onLoadMore}
      />,
    );
    expect(screen.queryByRole('button', { name: 'See more' })).toBeNull();

    rerender(
      <ProjectConversationList
        items={items}
        labels={{ ...labels, loadMoreLabel: 'Load older chats' }}
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Load older chats' }),
    );

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('disables See more while the next page loads', () => {
    renderList({ hasMore: true, isLoadingMore: true, onLoadMore: vi.fn() });

    const button = screen.getByRole('button', { name: 'See more' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('announces the loading state', () => {
    renderList({ isLoading: true });

    expect(
      within(screen.getByRole('status')).getByText('Loading chats'),
    ).toBeTruthy();
  });

  it('renders the same rows in RTL with logical alignment', () => {
    document.documentElement.dir = 'rtl';
    renderList({ onRename: vi.fn() });

    const row = screen.getByRole('button', { name: 'Login article' });
    expect(row.className).toContain('text-start');
    expect(row.className).not.toMatch(/\btext-left\b|\bpl-|\bml-/);
    expect(
      screen.getByRole('button', { name: 'More actions for Login article' })
        .className,
    ).toContain('me-2');
  });

  describe('unread rows', () => {
    const unread = [
      { id: 'c1', title: 'Weekly summary', isUnread: true },
      { id: 'c2', title: 'Login article' },
    ];

    it('describes an unread row as unread without changing its name', () => {
      renderList({
        items: unread,
        labels: { ...labels, unreadLabel: 'Unread' },
      });

      expect(
        screen.getByRole('button', {
          name: 'Weekly summary',
          description: 'Unread',
        }),
      ).toBeTruthy();
    });

    it('gives a read row no unread description', () => {
      renderList({ items: unread });

      expect(
        screen.getByRole('button', { name: 'Login article', description: '' }),
      ).toBeTruthy();
      expect(screen.getAllByText('Unread')).toHaveLength(1);
    });

    it('leads each row with a status point: filled when unread, an outline when read', () => {
      renderList({ items: unread });

      const pointSelector = 'li > button > span[aria-hidden] > span';
      // eslint-disable-next-line testing-library/no-node-access -- the status point is decorative and has no role
      const points = [...document.querySelectorAll(pointSelector)];
      expect(points.map((point) => point.className)).toEqual([
        expect.stringMatching(/unreadDot/),
        expect.stringMatching(/readDot/),
      ]);
    });

    it('sets the read point colour as a CSS variable', () => {
      renderList({ items: unread, colors: { readDot: 'gray' } });

      expect(
        screen
          .getByRole('region', { name: 'Chats' })
          .style.getPropertyValue('--pcl-read-dot'),
      ).toBe('gray');
    });

    it('hides the row menu on desktop until the row is hovered or focused', () => {
      renderList({ items: unread, onRename: vi.fn() });

      expect(
        screen.getByRole('button', { name: 'More actions for Weekly summary' })
          .className,
      ).toContain('desktop:opacity-0');
    });

    it('styles the unread title with the unread class and a read one with the row class', () => {
      renderList({ items: unread });

      expect(screen.getByText('Weekly summary').className).toContain(
        'dial-body-semi-text',
      );
      expect(screen.getByText('Login article').className).toContain(
        'dial-body-text',
      );
    });

    it('takes the unread title class from the typography prop', () => {
      renderList({
        items: unread,
        typography: { unreadRowTitleClassName: 'dial-small-semi-text' },
      });

      expect(screen.getByText('Weekly summary').className).toContain(
        'dial-small-semi-text',
      );
    });

    it('sets the unread dot colour as a CSS variable', () => {
      renderList({ items: unread, colors: { unreadDot: 'red' } });

      expect(
        screen
          .getByRole('region', { name: 'Chats' })
          .style.getPropertyValue('--pcl-unread-dot'),
      ).toBe('red');
    });

    it('keeps focus on a row that turns unread in place', async () => {
      const { rerender } = render(
        <ProjectConversationList
          items={[{ id: 'c1', title: 'Weekly summary' }]}
          labels={labels}
          onRetry={vi.fn()}
          onOpen={vi.fn()}
        />,
      );
      const row = screen.getByRole('button', { name: 'Weekly summary' });
      row.focus();

      rerender(
        <ProjectConversationList
          items={[{ id: 'c1', title: 'Weekly summary', isUnread: true }]}
          labels={labels}
          onRetry={vi.fn()}
          onOpen={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', {
          name: 'Weekly summary',
          description: 'Unread',
        }),
      ).toBe(row);
      // eslint-disable-next-line testing-library/no-node-access -- focus retention has no query; the focused element is the assertion
      await waitFor(() => expect(document.activeElement).toBe(row));
    });

    it('places the unread indicator with logical spacing only in RTL', () => {
      document.documentElement.dir = 'rtl';
      renderList({
        items: unread,
        onRename: vi.fn(),
      });

      const markup = screen.getByRole('region', { name: 'Chats' }).innerHTML;
      expect(markup).not.toMatch(/\b(ml|mr|pl|pr)-\d/);
    });
  });
});
