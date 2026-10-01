import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type CSSProperties, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheetShell } from '../BottomSheetShell';

/*
 * Hosts the shell the way a real consumer does — a trigger button that opens
 * it and content buttons inside the sheet body. The sheet itself is the real
 * UI kit `BottomSheet`, so focus, Escape and scroll lock are its behaviour.
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
  it('opens as a dialog named by its title, with an enabled close control', async () => {
    render(<SheetHost />);

    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));

    expect(screen.getByRole('dialog', { name: 'Pick a model' })).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('moves focus to the sheet when it opens', async () => {
    render(<SheetHost />);

    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));

    // The kit focuses the panel itself rather than its first control.
    await waitFor(() =>
      expect(screen.getByRole('dialog').matches(':focus')).toBe(true),
    );
  });

  it('closes the sheet on Escape', async () => {
    render(<SheetHost />);

    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the sheet from the close control', async () => {
    render(<SheetHost />);

    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a back control only with onBack, and calls it', async () => {
    const onBack = vi.fn();
    render(
      <BottomSheetShell
        isOpen
        title="Theme"
        closeLabel="Close"
        onClose={vi.fn()}
        onBack={onBack}
        backLabel="Back to settings"
      >
        Body
      </BottomSheetShell>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to settings' }),
    );

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('is named by aria-label and has no header when it has no title', () => {
    render(
      <BottomSheetShell isOpen aria-label="Menu" onClose={vi.fn()}>
        Body
      </BottomSheetShell>,
    );

    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('locks body scroll while open and releases it on close', async () => {
    const { rerender } = render(
      <BottomSheetShell
        isOpen
        title="Sheet"
        closeLabel="Close"
        onClose={vi.fn()}
      >
        Body
      </BottomSheetShell>,
    );

    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));

    rerender(
      <BottomSheetShell
        isOpen={false}
        title="Sheet"
        closeLabel="Close"
        onClose={vi.fn()}
      >
        Body
      </BottomSheetShell>,
    );

    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('puts the colour overrides and the caller style on the panel, and the colours on the backdrop', () => {
    render(
      <BottomSheetShell
        isOpen
        title="Sheet"
        closeLabel="Close"
        onClose={vi.fn()}
        colors={{ sheetBg: 'red', backdrop: 'blue' }}
        style={{ '--host-var': 'green' } as CSSProperties}
      >
        Body
      </BottomSheetShell>,
    );

    const panel = screen.getByRole('dialog');
    expect(panel.style.getPropertyValue('--ci-sheet-bg')).toBe('red');
    expect(panel.style.getPropertyValue('--host-var')).toBe('green');
    // eslint-disable-next-line testing-library/no-node-access -- the backdrop has no role; its inline style is the assertion
    const backdrop = panel.closest('.z-popup') as HTMLElement;
    expect(backdrop.style.getPropertyValue('--ci-backdrop')).toBe('blue');
  });
});
