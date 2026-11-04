import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteConfirmationDrawer } from '../DeleteConfirmationDrawer';

const onConfirm = vi.fn();
const onClose = vi.fn();

const renderDrawer = (
  props?: Partial<Parameters<typeof DeleteConfirmationDrawer>[0]>,
) =>
  render(
    <DeleteConfirmationDrawer
      open
      title="Delete project"
      names={['Research']}
      message="Are you sure?"
      consequences={['All shared configurations will be lost']}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );

describe('DeleteConfirmationDrawer', () => {
  beforeEach(() => {
    onConfirm.mockClear();
    onClose.mockClear();
  });

  it('names the drawer with its title and lists the consequences before the final bullet', () => {
    renderDrawer();

    expect(screen.getByRole('dialog', { name: 'Delete project' })).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual(['All shared configurations will be lost', 'Cannot be undone']);
  });

  it('delegates confirm and cancel', async () => {
    renderDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks Cancel and the close control while the delete is in flight', async () => {
    renderDrawer({ isLoading: true });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).not.toHaveBeenCalled();
  });
});
