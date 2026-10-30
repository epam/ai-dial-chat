import { render, screen, within } from '@testing-library/react';
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

  it('offers Show more only while more exist and a handler is given', async () => {
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
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();

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

  it('disables Show more while the next page loads', () => {
    renderList({ hasMore: true, isLoadingMore: true, onLoadMore: vi.fn() });

    const button = screen.getByRole('button', { name: 'Show more' });
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
});
