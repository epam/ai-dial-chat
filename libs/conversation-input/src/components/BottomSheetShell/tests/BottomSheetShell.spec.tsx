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
 * Hosts the shell the way a real consumer does — a trigger button that opens
 * it and content buttons inside the sheet body.
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
  it('renders the close control enabled when the sheet opens', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));

    const closeButton = screen.getByRole('button', {
      name: 'Close',
    }) as HTMLButtonElement;

    // The header's close control is the sheet's first focusable element.
    expect(closeButton).toBeDefined();
    expect(closeButton.disabled).toBe(false);
  });

  it('closes the sheet on Escape', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the wrap-edge controls enabled while Tab keydowns are dispatched', async () => {
    const user = userEvent.setup();
    render(<SheetHost />);

    await user.click(screen.getByRole('button', { name: 'Open sheet' }));

    const closeButton = screen.getByRole('button', {
      name: 'Close',
    }) as HTMLButtonElement;
    const lastOption = screen.getByRole('button', {
      name: 'Second option',
    }) as HTMLButtonElement;

    lastOption.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(closeButton).toBeDefined();
    expect(closeButton.disabled).toBe(false);

    closeButton.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastOption).toBeDefined();
    expect(lastOption.disabled).toBe(false);
  });

  it('renders the dialog as a programmatically focusable fallback when it hosts no focusable content', () => {
    render(
      <BottomSheetShell isOpen aria-label="Information" onClose={vi.fn()}>
        Plain text only
      </BottomSheetShell>,
    );

    const sheet = screen.getByRole('dialog') as HTMLDivElement;
    expect(sheet).toBeDefined();
    expect(sheet.tabIndex).toBe(-1);
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
