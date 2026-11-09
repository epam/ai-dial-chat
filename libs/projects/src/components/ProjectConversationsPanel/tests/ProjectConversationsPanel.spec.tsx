import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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

/* The dialog moves its initial focus asynchronously; typing before it has lands keystrokes outside the input. */
const openRenameDialog = async () => {
  await openRowMenu('Rename');
  const dialog = await screen.findByRole('dialog', { name: 'Rename chat' });
  await waitFor(() =>
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no query
    expect(dialog.contains(document.activeElement)).toBe(true),
  );
  return screen.getByLabelText('Chat name');
};

describe('ProjectConversationsPanel', () => {
  it('drops the Chats empty state while the outputs slot shows content', () => {
    renderPanel({ items: [], hasOutputs: true, outputs: <p>outputs</p> });

    expect(screen.getByText('outputs')).toBeTruthy();
    expect(screen.queryByText(labels.list.emptyTitle)).toBeNull();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the host composer above the list', () => {
    renderPanel({ composer: <p>composer here</p> });

    expect(screen.getByText('composer here')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Chats' })).toBeTruthy();
  });

  it('renders the host outputs between the composer and the Chats list', () => {
    renderPanel({
      composer: <p>composer here</p>,
      outputs: <p>outputs here</p>,
    });

    const composer = screen.getByText('composer here');
    const outputs = screen.getByText('outputs here');
    const chats = screen.getByRole('heading', { name: 'Chats' });
    expect(
      composer.compareDocumentPosition(outputs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      outputs.compareDocumentPosition(chats) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has no row menu without rename and delete handlers', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', { name: 'More actions for Old title' }),
    ).toBeNull();
  });

  it('keeps Save disabled until the name is changed', async () => {
    const onRename = vi.fn(async () => undefined);
    renderPanel({ onRename });

    const input = await openRenameDialog();
    const save = screen.getByRole('button', { name: 'Save' });
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(input, '  ');
    expect((save as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(input, '!');
    expect((save as HTMLButtonElement).disabled).toBe(false);
    expect(onRename).not.toHaveBeenCalled();
  });

  it('refuses an empty name and renames with the trimmed one', async () => {
    const onRename = vi.fn(async () => undefined);
    renderPanel({ onRename });

    const input = await openRenameDialog();
    await userEvent.clear(input);
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await userEvent.type(input, '{Enter}');
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

  it('fills the rename input with the AI title', async () => {
    const onGenerateTitle = vi.fn(async () => 'AI title');
    renderPanel({ onRename: vi.fn(), onGenerateTitle });

    await openRowMenu('Rename');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Rename with AI' }),
    );

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Chat name') as HTMLInputElement).value,
      ).toBe('AI title'),
    );
    expect(onGenerateTitle).toHaveBeenCalledWith('c1');
  });

  it('shows an error when the AI title fails and hides the button without a handler', async () => {
    const onGenerateTitle = vi.fn(async () => {
      throw new Error('failed');
    });
    renderPanel({ onRename: vi.fn(), onGenerateTitle });

    await openRowMenu('Rename');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Rename with AI' }),
    );
    expect(
      await screen.findByText('Could not generate a name. Try again.'),
    ).toBeTruthy();
  });

  it('has no AI button when onGenerateTitle is omitted', async () => {
    renderPanel({ onRename: vi.fn() });

    await openRowMenu('Rename');
    await screen.findByLabelText('Chat name');
    expect(screen.queryByRole('button', { name: 'Rename with AI' })).toBeNull();
  });

  it('keeps the rename dialog open when the host rejects', async () => {
    const onRename = vi.fn(async () => {
      throw new Error('failed');
    });
    renderPanel({ onRename });

    await userEvent.type(await openRenameDialog(), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

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

  it('closes the rename dialog from Cancel without renaming', async () => {
    const onRename = vi.fn(async () => undefined);
    renderPanel({ onRename });

    await openRowMenu('Rename');
    await screen.findByRole('dialog', { name: 'Rename chat' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Rename chat' })).toBeNull(),
    );
    expect(onRename).not.toHaveBeenCalled();
  });

  it('renames on Enter', async () => {
    const onRename = vi.fn(async () => undefined);
    renderPanel({ onRename });

    const input = await openRenameDialog();
    await userEvent.clear(input);
    await userEvent.type(input, 'Login article{Enter}');

    await waitFor(() =>
      expect(onRename).toHaveBeenCalledWith('c1', 'Login article'),
    );
  });

  it('cannot close the rename dialog while the rename is pending', async () => {
    let finishRename: () => void = () => undefined;
    const onRename = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRename = resolve;
        }),
    );
    renderPanel({ onRename });

    await userEvent.type(await openRenameDialog(), ' 2');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onRename).toHaveBeenCalled());

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Rename chat' })).toBeTruthy();

    finishRename();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Rename chat' })).toBeNull(),
    );
  });

  it('moves focus to the row that takes the place of a deleted one', async () => {
    const StatefulPanel = () => {
      const [items, setItems] = useState([
        { id: 'c1', title: 'Old title' },
        { id: 'c2', title: 'Next title' },
      ]);
      return (
        <ProjectConversationsPanel
          items={items}
          onRetry={vi.fn()}
          onOpen={vi.fn()}
          onDelete={async (id) => {
            setItems((prev) => prev.filter((item) => item.id !== id));
          }}
          labels={labels}
        />
      );
    };
    render(<StatefulPanel />);

    await openRowMenu('Delete');
    await screen.findByRole('dialog', { name: 'Delete "Old title"?' });
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Delete' }).at(-1) as HTMLElement,
    );

    const nextRow = await screen.findByRole('button', { name: 'Next title' });
    // eslint-disable-next-line testing-library/no-node-access -- focus placement has no query; the focused element is the assertion
    await waitFor(() => expect(document.activeElement).toBe(nextRow));
  });

  it('closes the rename dialog when a refresh removes its row', async () => {
    const onRename = vi.fn(async () => undefined);
    const { rerender } = renderPanel({ onRename });
    await openRowMenu('Rename');
    expect(await screen.findByLabelText('Chat name')).toBeTruthy();

    rerender(
      <ProjectConversationsPanel
        items={[]}
        onRetry={vi.fn()}
        onOpen={vi.fn()}
        onRename={onRename}
        labels={labels}
      />,
    );

    await waitFor(() =>
      expect(screen.queryByLabelText('Chat name')).toBeNull(),
    );
    expect(onRename).not.toHaveBeenCalled();
  });

  it('passes the load-more state through to the list', async () => {
    const onLoadMore = vi.fn();
    renderPanel({ hasMore: true, onLoadMore });

    await userEvent.click(screen.getByRole('button', { name: 'See more' }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});
