import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheetShell } from '../BottomSheetShell';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Standard: 'standard' },
  CloseButton: ({
    ariaLabel,
    onClose,
  }: {
    ariaLabel?: string;
    onClose?: () => void;
  }) => <button aria-label={ariaLabel} onClick={onClose} />,
  GhostIconButton: ({
    icon,
    onClick,
    'aria-label': ariaLabel,
  }: {
    icon?: ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button aria-label={ariaLabel} onClick={onClick}>
      {icon}
    </button>
  ),
}));

vi.mock('@tabler/icons-react', () => ({
  IconArrowLeft: () => <svg data-icon="back" />,
}));

/*
 * Hosts the shell the way a real consumer does — a trigger button that both
 * opens it and receives focus back on close — so the focus assertions cover
 * the full open/close cycle.
 */
const SheetHost = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open sheet</button>
      <BottomSheetShell
        isOpen={isOpen}
        title="Pick a model"
        closeLabel="Close"
        onClose={() => setIsOpen(false)}
      >
        <button>First option</button>
        <button>Second option</button>
      </BottomSheetShell>
    </>
  );
};

describe('BottomSheetShell', () => {
  it('moves focus onto the first focusable element when the sheet opens', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));

    // The header's close control is the first focusable element in the sheet.
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close' }),
    );
  });

  it('restores focus to the triggering control when the sheet closes', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);
    const trigger = screen.getByRole('button', { name: 'Open sheet' });

    await user.click(trigger);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab inside the sheet, wrapping at both edges', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    const closeControl = screen.getByRole('button', { name: 'Close' });
    const lastOption = screen.getByRole('button', { name: 'Second option' });

    lastOption.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeControl);

    closeControl.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastOption);
  });

  it('focuses the sheet itself when it hosts no focusable content', () => {
    render(
      <BottomSheetShell isOpen aria-label="Information" onClose={vi.fn()}>
        Plain text only
      </BottomSheetShell>,
    );

    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('locks body scroll while open and releases it on close', () => {
    const { rerender } = render(
      <BottomSheetShell
        isOpen
        title="Pick a model"
        closeLabel="Close"
        onClose={vi.fn()}
      >
        <button>First option</button>
      </BottomSheetShell>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <BottomSheetShell
        isOpen={false}
        title="Pick a model"
        closeLabel="Close"
        onClose={vi.fn()}
      >
        <button>First option</button>
      </BottomSheetShell>,
    );

    expect(document.body.style.overflow).toBe('');
  });
});
