import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteConfirmationDialog } from '../DeleteConfirmationDialog';

const onConfirm = vi.fn();
const onClose = vi.fn();

const renderDialog = (
  props?: Partial<Parameters<typeof DeleteConfirmationDialog>[0]>,
) =>
  render(
    <DeleteConfirmationDialog
      open
      title="Delete chat"
      names={['Weekly sync']}
      message="Are you sure?"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );

describe('DeleteConfirmationDialog', () => {
  beforeEach(() => {
    onConfirm.mockClear();
    onClose.mockClear();
  });

  it('names the dialog with its title and shows the body', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Delete chat' })).toBeTruthy();
    expect(screen.getByText('Weekly sync')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    expect(screen.getByText('Cannot be undone')).toBeTruthy();
  });

  it('delegates confirm and cancel with default labels', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uses host labels for the actions', () => {
    renderDialog({ labels: { confirm: 'Supprimer', cancel: 'Annuler' } });

    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
  });

  it('ignores Escape while deleting and announces the status', async () => {
    renderDialog({ isLoading: true, labels: { deleting: 'Deleting…' } });

    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Deleting…')).toBeTruthy();
  });

  it('renders children after the consequences', () => {
    renderDialog({ children: <p role="alert">Failed</p> });

    expect(screen.getByRole('alert').textContent).toBe('Failed');
  });
});
