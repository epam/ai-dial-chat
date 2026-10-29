import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ProjectConversationsPanelLabels,
  ProjectConversationsPanelProps,
} from '../../../models/project-conversations-panel-props';
import { ProjectConversationsPanel } from '../ProjectConversationsPanel';

const labels: ProjectConversationsPanelLabels = {
  list: {
    title: 'Chats',
    openLabel: (title) => title,
    moreActionsLabel: (title) => `More actions for ${title}`,
    renameLabel: 'Rename',
    deleteLabel: 'Delete',
    loadingLabel: 'Loading chats',
    errorLabel: 'Could not load the chats',
    retryLabel: 'Retry',
    emptyTitle: 'No outputs or chats yet',
    emptyDescription: 'Your outputs and chats will appear here once started.',
  },
  renameTitle: 'Rename chat',
  renameInputLabel: 'Chat name',
  renameEmptyError: 'Enter a chat name',
  renameSaveLabel: 'Save',
  deleteTitle: (title) => `Delete "${title}"?`,
  deleteDescription: 'The chat will be deleted.',
};

const renderPanel = (props: Partial<ProjectConversationsPanelProps> = {}) =>
  render(
    <ProjectConversationsPanel
      items={[{ id: 'c1', title: 'Old title' }]}
      onRetry={vi.fn()}
      onOpen={vi.fn()}
      labels={labels}
      {...props}
    />,
  );

const openRowMenu = async (item: 'Rename' | 'Delete') => {
  await userEvent.click(
    screen.getByRole('button', { name: 'More actions for Old title' }),
  );
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
};

describe('ProjectConversationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the host composer above the list', () => {
    renderPanel({ composer: <p>composer here</p> });

    expect(screen.getByText('composer here')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Chats' })).toBeTruthy();
  });

  it('has no row menu without rename and delete handlers', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', { name: 'More actions for Old title' }),
    ).toBeNull();
  });

  it('refuses an empty name and renames with the trimmed one', async () => {
    const onRename = vi.fn(async () => undefined);
    renderPanel({ onRename });

    await openRowMenu('Rename');
    const input = await screen.findByLabelText('Chat name');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a chat name')).toBeTruthy();

    await userEvent.type(input, '  Login article ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith('c1', 'Login article'),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Rename chat' })).toBeNull(),
    );
  });

  it('keeps the rename dialog open when the host rejects', async () => {
    const onRename = vi.fn(async () => {
      throw new Error('failed');
    });
    renderPanel({ onRename });

    await openRowMenu('Rename');
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onRename).toHaveBeenCalled());
    expect(screen.getByRole('dialog', { name: 'Rename chat' })).toBeTruthy();
  });

  it('deletes after confirmation and returns focus to the row menu on cancel', async () => {
    const onDelete = vi.fn(async () => undefined);
    renderPanel({ onDelete });
    const trigger = screen.getByRole('button', {
      name: 'More actions for Old title',
    });

    await openRowMenu('Delete');
    await screen.findByRole('dialog', { name: 'Delete "Old title"?' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // eslint-disable-next-line testing-library/no-node-access -- focus restoration has no query; the focused element is the assertion
    await waitFor(() => expect(document.activeElement).toBe(trigger));

    await openRowMenu('Delete');
    await screen.findByRole('dialog', { name: 'Delete "Old title"?' });
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Delete' }).at(-1) as HTMLElement,
    );

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c1'));
  });
});
