import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptFolderActions } from '../../../models/prompt-editor-props';
import { PromptFolderField } from '../PromptFolderField';

const FOLDERS = [
  { id: 'Work', name: 'Work' },
  { id: 'Work/AI', name: 'AI' },
];

const makeActions = (
  overrides: Partial<PromptFolderActions> = {},
): PromptFolderActions => ({
  onCreateFolder: vi.fn().mockResolvedValue(undefined),
  onRenameFolder: vi.fn().mockResolvedValue(undefined),
  onDeleteFolder: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const renderField = (
  props?: Partial<ComponentProps<typeof PromptFolderField>>,
) => {
  const actions = props?.actions ?? makeActions();
  const onChange = props?.onChange ?? vi.fn();
  render(
    <PromptFolderField
      value=""
      folders={FOLDERS}
      actions={actions}
      onChange={onChange}
      {...props}
    />,
  );
  return { actions, onChange };
};

describe('PromptFolderField', () => {
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('omits the mutation controls when no actions are supplied', () => {
    render(<PromptFolderField value="" folders={FOLDERS} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Create folder' })).toBeNull();
  });

  it('disables rename and delete while the root folder is selected', () => {
    renderField({ value: '' });

    expect(
      screen.getByRole('button', { name: 'Rename folder' }),
    ).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('button', { name: 'Delete folder' }),
    ).toHaveProperty('disabled', true);
  });

  it('creates a root-level folder with no parentId', async () => {
    const { actions } = renderField({ value: '' });

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(
      screen.getByRole('textbox', { name: /Folder name/ }),
      'Drafts',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(actions.onCreateFolder).toHaveBeenCalledWith('Drafts', undefined),
    );
  });

  it('creates a nested folder under the selected one', async () => {
    const { actions } = renderField({ value: 'Work' });

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(screen.getByRole('textbox', { name: /Folder name/ }), 'AI');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(actions.onCreateFolder).toHaveBeenCalledWith('AI', 'Work'),
    );
  });

  it('selects the created folder when the host resolves its path', async () => {
    const actions = makeActions({
      onCreateFolder: vi.fn().mockResolvedValue('Work/Drafts'),
    });
    const { onChange } = renderField({ value: 'Work', actions });

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(
      screen.getByRole('textbox', { name: /Folder name/ }),
      'Drafts',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('Work/Drafts'));
  });

  it('blocks a mutation and shows the message when validation rejects the name', async () => {
    const actions = makeActions({
      onValidateFolderName: () => 'Name is invalid',
    });
    renderField({ value: '', actions });

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(
      screen.getByRole('textbox', { name: /Folder name/ }),
      'bad/name',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(actions.onCreateFolder).not.toHaveBeenCalled();
    expect(screen.getByText('Name is invalid')).toBeTruthy();
  });

  it('keeps the sub-form open and shows the host conflict message on failure', async () => {
    const actions = makeActions({
      onCreateFolder: vi.fn().mockRejectedValue(new Error('409')),
    });
    renderField({ value: '', actions, nameError: 'Folder already exists' });

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(
      screen.getByRole('textbox', { name: /Folder name/ }),
      'Work',
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByText('Folder already exists')).toBeTruthy(),
    );
    expect(screen.getByRole('textbox', { name: /Folder name/ })).toBeTruthy();
  });

  it('seeds the rename field with the selected folder’s last segment', async () => {
    renderField({ value: 'Work/AI' });

    await user.click(screen.getByRole('button', { name: 'Rename folder' }));

    expect(screen.getByDisplayValue('AI')).toBeTruthy();
  });

  it('renames the selected folder and follows the new path', async () => {
    const actions = makeActions({
      onRenameFolder: vi.fn().mockResolvedValue('Work/ML'),
    });
    const { onChange } = renderField({ value: 'Work/AI', actions });

    await user.click(screen.getByRole('button', { name: 'Rename folder' }));
    const field = screen.getByRole('textbox', { name: /Folder name/ });
    await user.clear(field);
    await user.type(field, 'ML');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(actions.onRenameFolder).toHaveBeenCalledWith('Work/AI', 'ML'),
    );
    expect(onChange).toHaveBeenCalledWith('Work/ML');
  });

  it('requires confirmation before deleting, and cancel dispatches nothing', async () => {
    const { actions } = renderField({ value: 'Work' });

    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(actions.onDeleteFolder).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('resets the selection to root after deleting the selected folder', async () => {
    const { actions, onChange } = renderField({ value: 'Work' });

    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete folder' }),
    );

    await waitFor(() =>
      expect(actions.onDeleteFolder).toHaveBeenCalledWith('Work'),
    );
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the empty state when there are no folders', () => {
    renderField({ folders: [] });

    expect(screen.getByText('No folders yet')).toBeTruthy();
  });

  it('renders the picker error under the field', () => {
    renderField({ error: 'Could not move the prompt' });

    expect(screen.getByText('Could not move the prompt')).toBeTruthy();
  });
});
