import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityHeaderItem } from '../../../models/entity';
import { CatalogEntityType } from '../../../types/entity-type';
import { ConfirmationDialog } from '../ConfirmationDialog';

const item: EntityHeaderItem = {
  type: CatalogEntityType.Skill,
  name: 'Weekly digest',
  version: '1.0',
};

const onConfirm = vi.fn();
const onClose = vi.fn();

const renderDialog = (
  props?: Partial<Parameters<typeof ConfirmationDialog>[0]>,
) =>
  render(
    <ConfirmationDialog
      open
      title="Delete skill"
      item={item}
      message="Are you sure?"
      consequences={['Cannot be undone']}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant={ConfirmationPopupVariant.Danger}
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    />,
  );

describe('ConfirmationDialog', () => {
  beforeEach(() => {
    onConfirm.mockClear();
    onClose.mockClear();
  });

  it('names the dialog with its title', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Delete skill' })).toBeTruthy();
  });

  it('shows the content block the in-panel step shows', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: 'Weekly digest' })).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).toBe('Cannot be undone');
  });

  it('delegates confirm and cancel', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks every route out while the action is in flight', async () => {
    renderDialog({ isLoading: true, loadingStatusLabel: 'Deleting' });

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    await userEvent.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Deleting').getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('blocks only confirming while the required input is unsatisfied', () => {
    renderDialog({ isConfirmDisabled: true });

    expect(
      screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('renders nothing when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
