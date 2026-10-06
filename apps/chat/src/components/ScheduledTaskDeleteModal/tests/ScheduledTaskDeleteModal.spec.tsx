import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScheduledTaskDeleteModal from '../ScheduledTaskDeleteModal';

/*
 * The kit's `Popup` renders for real here: mocking it hid that the dialog used
 * to be handed a node header with no accessible name, and it is the kit that
 * decides whether a `footer` node reaches the screen at all.
 */
const renderModal = (
  props?: Partial<React.ComponentProps<typeof ScheduledTaskDeleteModal>>,
) =>
  render(
    <ScheduledTaskDeleteModal
      open
      taskName="Daily summary"
      onConfirm={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('ScheduledTaskDeleteModal', () => {
  it('names the dialog with the delete title', () => {
    renderModal();

    expect(
      screen.getByRole('dialog', {
        name: 'scheduledTasks.detail.deleteConfirmTitle',
      }),
    ).toBeTruthy();
  });

  it('identifies the task by name only, without a type label', () => {
    renderModal();

    expect(screen.getByText('Daily summary')).toBeTruthy();
    expect(screen.queryByText('scheduledTasks.typeLabel')).toBeNull();
  });

  it('renders the warning sentence and the consequences list', () => {
    renderModal();

    /* The suite-wide `Trans` mock renders the i18nKey itself. */
    expect(
      screen.getByText('scheduledTasks.detail.deleteConfirmDescription'),
    ).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [
        'scheduledTasks.detail.deleteConsequenceConversationsAccessible',
        'basic.consequenceCannotBeUndone',
      ],
    );
  });

  it('renders nothing when closed', () => {
    renderModal({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fires onConfirm when the confirm action is activated', async () => {
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.delete' }),
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('fires onClose when the cancel action is activated', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    await userEvent.click(
      screen.getByRole('button', { name: 'buttons.cancel' }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('freezes both actions and announces progress while deleting', () => {
    renderModal({ isDeleting: true });

    const confirmButton = screen.getByRole('button', {
      name: 'buttons.delete',
    }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    /* Cancel freezes too — dismissing the dialog mid-request would leave
       the page state contradicting the in-flight delete. */
    const cancelButton = screen.getByRole('button', {
      name: 'buttons.cancel',
    }) as HTMLButtonElement;
    expect(cancelButton.disabled).toBe(true);

    expect(
      screen.getByText('basic.deletingStatus').getAttribute('aria-live'),
    ).toBe('polite');
  });
});
