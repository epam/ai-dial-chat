import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmationFooter } from '../ConfirmationFooter';

const renderFooter = (
  props?: Partial<Parameters<typeof ConfirmationFooter>[0]>,
) =>
  render(
    <ConfirmationFooter
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );

describe('ConfirmationFooter', () => {
  it('calls back when the action is confirmed', async () => {
    const onConfirm = vi.fn();
    renderFooter({ onConfirm });

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls back when the step is cancelled', async () => {
    const onCancel = vi.fn();
    renderFooter({ onCancel });

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables both actions while the action is in flight', () => {
    renderFooter({ isLoading: true });

    expect(
      screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('disables only confirming while the required input is unsatisfied', () => {
    renderFooter({ isConfirmDisabled: true });

    expect(
      screen.getByRole('button', { name: 'Delete' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('announces the in-flight status to assistive tech', () => {
    renderFooter({ isLoading: true, loadingStatusLabel: 'Deleting' });

    /* The in-flight spinner is a status region of its own, so the
     * announcement is located by its text rather than by role. */
    expect(screen.getByText('Deleting').getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('announces nothing once the action has settled', () => {
    renderFooter({ loadingStatusLabel: 'Deleting' });

    expect(screen.queryByText('Deleting')).toBeNull();
  });
});

/*
 * The trash icon is `aria-hidden` by design — it decorates a button that
 * already carries its label — and the border color lands as an inline custom
 * property, so neither is reachable through an accessible query.
 */
/* eslint-disable testing-library/no-node-access */
describe('ConfirmationFooter presentation', () => {
  it('marks the confirm button with a trash icon for the danger variant', () => {
    renderFooter({ variant: ConfirmationPopupVariant.Danger });
    const confirmButton = screen.getByRole('button', { name: 'Delete' });

    expect(confirmButton.querySelector('svg')).toBeTruthy();
  });

  it('leaves the confirm button unadorned for the info variant', () => {
    renderFooter();
    const confirmButton = screen.getByRole('button', { name: 'Delete' });

    expect(confirmButton.querySelector('svg')).toBeNull();
  });

  it('wires the border color to the custom property the stylesheet reads', () => {
    const { container } = renderFooter({
      styles: { colors: { border: 'rgb(1, 2, 3)' } },
    });
    const actionRow = container.firstElementChild as HTMLElement;

    expect(actionRow.style.getPropertyValue('--cfm-footer-border')).toBe(
      'rgb(1, 2, 3)',
    );
  });
});
