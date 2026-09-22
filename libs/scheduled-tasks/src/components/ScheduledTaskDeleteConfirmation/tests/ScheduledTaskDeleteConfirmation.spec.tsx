import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTaskDeleteConfirmation } from '../ScheduledTaskDeleteConfirmation';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  ButtonVariant: { Danger: 'danger' },
  Popup: ({
    header,
    children,
    mainButtons,
    onClose,
  }: {
    header: ReactNode;
    children: ReactNode;
    mainButtons: { label: string; onClick: () => void; disabled?: boolean }[];
    onClose: () => void;
  }) => (
    <div role="dialog">
      <button aria-label="Close" onClick={onClose}>
        Close
      </button>
      <h1>{header}</h1>
      {children}
      {mainButtons.map((button) => (
        <button
          key={button.label}
          disabled={button.disabled}
          onClick={button.onClick}
        >
          {button.label}
        </button>
      ))}
    </div>
  ),
}));

describe('ScheduledTaskDeleteConfirmation', () => {
  const props = {
    open: true,
    taskName: '<task>',
    title: 'Delete task',
    body: 'This action is permanent.',
    consequences: ['Runs remain accessible'],
    cancelLabel: 'Cancel',
    confirmLabel: 'Delete',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    props.onConfirm.mockClear();
    props.onClose.mockClear();
  });

  it('renders host content as text and delegates idle cancel and confirm', () => {
    render(<ScheduledTaskDeleteConfirmation {...props} />);
    expect(screen.getByText('<task>')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('prevents confirmation and dismissal while deletion is pending', () => {
    render(
      <ScheduledTaskDeleteConfirmation
        {...props}
        isDeleting
        pendingLabel="Deleting"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      screen.getByRole('button', { name: 'Deleting' }).hasAttribute('disabled'),
    ).toBe(true);
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
