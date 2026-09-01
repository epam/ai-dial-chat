import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useSheetNavigation } from '../../../hooks/useSheetNavigation';
import { NavigableBottomSheet } from '../NavigableBottomSheet';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  ElementSize: { Standard: 'standard' },
  GhostIconButton: ({
    'aria-label': ariaLabel,
    onClick,
  }: {
    'aria-label': string;
    onClick?: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClick} />,
  CloseButton: ({
    ariaLabel,
    onClose,
  }: {
    ariaLabel: string;
    onClose: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClose} />,
}));

const sheetProps = {
  title: 'Test',
  closeLabel: 'Close',
  backLabel: 'Back',
};

const PushButton = ({ title, body }: { title: string; body: string }) => {
  const { push } = useSheetNavigation();
  return (
    <button
      type="button"
      onClick={() => push({ title, content: <span>{body}</span> })}
    >
      {`Open ${title}`}
    </button>
  );
};

describe('NavigableBottomSheet', () => {
  it('renders root children and no back button when the stack is empty', () => {
    render(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={vi.fn()}>
        <button type="button">Root content</button>
      </NavigableBottomSheet>,
    );
    expect(screen.getByRole('button', { name: 'Root content' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows the pushed page title and content', async () => {
    const user = userEvent.setup();
    render(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={vi.fn()}>
        <PushButton title="Profile" body="Profile body" />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Profile' }));
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Profile body')).toBeTruthy();
  });

  it('pops the top page when the back button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={vi.fn()}>
        <PushButton title="Settings" body="Settings body" />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByText('Settings body')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByText('Settings body')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={onClose}>
        <PushButton title="Page" body="Page body" />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Page' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('resets the stack when isOpen transitions to false', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={vi.fn()}>
        <PushButton title="Deep" body="Deep content" />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Deep' }));
    expect(screen.getByText('Deep content')).toBeTruthy();

    rerender(
      <NavigableBottomSheet {...sheetProps} isOpen={false} onClose={vi.fn()}>
        <PushButton title="Deep" body="Deep content" />
      </NavigableBottomSheet>,
    );
    rerender(
      <NavigableBottomSheet {...sheetProps} isOpen onClose={vi.fn()}>
        <PushButton title="Deep" body="Deep content" />
      </NavigableBottomSheet>,
    );
    expect(screen.queryByText('Deep content')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Deep' })).toBeTruthy();
  });
});

describe('useSheetNavigation', () => {
  it('throws when used outside NavigableBottomSheet', () => {
    const ThrowingComponent = () => {
      useSheetNavigation();
      return null;
    };
    expect(() => render(<ThrowingComponent />)).toThrow(
      'useSheetNavigation must be used within a NavigableBottomSheet',
    );
  });
});
