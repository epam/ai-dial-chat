import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useSheetNavigation } from '../../../hooks/useSheetNavigation';
import NavigableBottomSheet from '../NavigableBottomSheet';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialCloseButton: ({
    ariaLabel,
    onClose,
  }: {
    ariaLabel: string;
    onClose: () => void;
  }) => <button type="button" aria-label={ariaLabel} onClick={onClose} />,
}));

const renderSheet = (isOpen = true, onClose = vi.fn()) =>
  render(
    <NavigableBottomSheet isOpen={isOpen} onClose={onClose} title="Test">
      <button type="button">Root content</button>
    </NavigableBottomSheet>,
  );

describe('NavigableBottomSheet', () => {
  it('renders root children with no header when stack is empty', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Root content' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /back/i })).toBeNull();
  });

  it('shows header and page content after push', async () => {
    const user = userEvent.setup();

    const PushButton = () => {
      const { push } = useSheetNavigation();
      return (
        <button
          type="button"
          onClick={() =>
            push({ title: 'Profile', content: <span>Profile body</span> })
          }
        >
          Open Profile
        </button>
      );
    };

    render(
      <NavigableBottomSheet isOpen onClose={vi.fn()} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Profile' }));
    expect(screen.getByText('Profile')).toBeTruthy();
    expect(screen.getByText('Profile body')).toBeTruthy();
  });

  it('pops top page when back button is clicked', async () => {
    const user = userEvent.setup();

    const PushButton = () => {
      const { push } = useSheetNavigation();
      return (
        <button
          type="button"
          onClick={() =>
            push({ title: 'Settings', content: <span>Settings body</span> })
          }
        >
          Open Settings
        </button>
      );
    };

    render(
      <NavigableBottomSheet isOpen onClose={vi.fn()} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByText('Settings body')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.queryByText('Settings body')).toBeNull();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  });

  it('calls onClose and clears stack when X button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    const PushButton = () => {
      const { push } = useSheetNavigation();
      return (
        <button
          type="button"
          onClick={() =>
            push({ title: 'Page', content: <span>Page body</span> })
          }
        >
          Open Page
        </button>
      );
    };

    render(
      <NavigableBottomSheet isOpen onClose={onClose} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Open Page' }));
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('resets stack when isOpen transitions to false', async () => {
    const user = userEvent.setup();

    const PushButton = () => {
      const { push } = useSheetNavigation();
      return (
        <button
          type="button"
          onClick={() =>
            push({ title: 'Deep', content: <span>Deep content</span> })
          }
        >
          Go deep
        </button>
      );
    };

    const { rerender } = render(
      <NavigableBottomSheet isOpen onClose={vi.fn()} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );

    await user.click(screen.getByRole('button', { name: 'Go deep' }));
    expect(screen.getByText('Deep content')).toBeTruthy();

    rerender(
      <NavigableBottomSheet isOpen={false} onClose={vi.fn()} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );
    rerender(
      <NavigableBottomSheet isOpen onClose={vi.fn()} title="Test">
        <PushButton />
      </NavigableBottomSheet>,
    );
    expect(screen.queryByText('Deep content')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go deep' })).toBeTruthy();
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
