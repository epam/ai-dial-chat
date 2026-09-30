import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskDeleteConfirmation } from '../ScheduledTaskDeleteConfirmation';

const onConfirm = vi.fn();
const onClose = vi.fn();

const renderConfirmation = (
  props?: Partial<Parameters<typeof ScheduledTaskDeleteConfirmation>[0]>,
) =>
  render(
    <ScheduledTaskDeleteConfirmation
      open
      taskName="<task>"
      typeLabel="Scheduled task"
      title="Delete task"
      body="This action is permanent."
      consequences={['Runs remain accessible', 'Cannot be undone']}
      cancelLabel="Cancel"
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );

describe('ScheduledTaskDeleteConfirmation', () => {
  beforeEach(() => {
    onConfirm.mockClear();
    onClose.mockClear();
  });

  /* The title is passed as a string precisely so the kit names the dialog with
   * it; a node header would leave the dialog unnamed. */
  it('names the dialog with its title', () => {
    renderConfirmation();

    expect(screen.getByRole('dialog', { name: 'Delete task' })).toBeTruthy();
  });

  it('echoes the task identity and the host-composed warning', () => {
    renderConfirmation();

    expect(screen.getByText('Scheduled task')).toBeTruthy();
    expect(screen.getByText('<task>')).toBeTruthy();
    expect(screen.getByText('This action is permanent.')).toBeTruthy();
  });

  it('renders the host icon in the identity card', () => {
    renderConfirmation({ icon: <svg aria-label="Task" /> });

    expect(screen.getByLabelText('Task')).toBeTruthy();
  });

  it('lists the consequences in the order given', () => {
    renderConfirmation();

    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      ['Runs remain accessible', 'Cannot be undone'],
    );
  });

  it('delegates confirm and cancel while idle', async () => {
    renderConfirmation();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks both actions and announces progress while deletion is pending', async () => {
    renderConfirmation({ isDeleting: true, pendingLabel: 'Deleting' });

    expect(
      screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByText('Deleting').getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('keeps the dialog open when the close control is used mid-deletion', async () => {
    renderConfirmation({ isDeleting: true, pendingLabel: 'Deleting' });

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    renderConfirmation({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
