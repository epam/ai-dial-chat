import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RatingToast from '../RatingToast';

const DEFAULT_PROPS = {
  title: 'Thank you!',
  description: 'You help us make better products',
  onDismiss: vi.fn(),
};

describe('RatingToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the title and description', () => {
    render(<RatingToast {...DEFAULT_PROPS} />);
    expect(screen.getByText('Thank you!')).toBeTruthy();
    expect(screen.getByText('You help us make better products')).toBeTruthy();
  });

  it('does not call onDismiss before 3000 ms', () => {
    const onDismiss = vi.fn();
    render(<RatingToast {...DEFAULT_PROPS} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(2999);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onDismiss after 3000 ms', () => {
    const onDismiss = vi.fn();
    render(<RatingToast {...DEFAULT_PROPS} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(3000);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('does not call onDismiss after unmounting before 3000 ms', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(
      <RatingToast {...DEFAULT_PROPS} onDismiss={onDismiss} />,
    );

    vi.advanceTimersByTime(1000);
    unmount();
    vi.advanceTimersByTime(3000);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('restarts the timer when the title prop changes', () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <RatingToast {...DEFAULT_PROPS} onDismiss={onDismiss} />,
    );

    vi.advanceTimersByTime(2000);
    rerender(
      <RatingToast
        title="New title"
        description={DEFAULT_PROPS.description}
        onDismiss={onDismiss}
      />,
    );
    vi.advanceTimersByTime(2000);

    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
