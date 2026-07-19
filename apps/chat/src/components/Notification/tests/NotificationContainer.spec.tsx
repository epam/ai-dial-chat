import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '../../../context/NotificationContext';
import NotificationContainer from '../NotificationContainer';

const dismissNotification = vi.fn();
let notifications: NotificationItem[] = [];

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ notifications, dismissNotification }),
}));

vi.mock('@epam/ai-dial-ui-kit', () => ({
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
  NotificationVariant: {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Success: 'success',
    Loading: 'loading',
  },
  DialNotification: ({
    variant,
    title,
    message,
    closable,
    onClose,
  }: {
    variant: string;
    title?: string;
    message: string;
    closable?: boolean;
    onClose?: () => void;
  }) => (
    <div role="alert" data-variant={variant}>
      {title && <div>{title}</div>}
      <div>{message}</div>
      {closable && <button aria-label="Close notification" onClick={onClose} />}
    </div>
  ),
}));

const makeItem = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: '1',
  variant: 'info' as NotificationItem['variant'],
  message: 'Test message',
  ...overrides,
});

describe('NotificationContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    notifications = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no notifications', () => {
    const { container } = render(<NotificationContainer />);
    expect(container.firstChild).toBeNull();
  });

  it.each(['error', 'warning', 'info', 'success', 'loading'])(
    'renders the %s severity with its own message',
    (variant) => {
      notifications = [
        makeItem({
          variant: variant as NotificationItem['variant'],
          message: `${variant} message`,
        }),
      ];
      render(<NotificationContainer />);
      expect(screen.getByText(`${variant} message`)).toBeTruthy();
      expect(screen.getByRole('alert').getAttribute('data-variant')).toBe(
        variant,
      );
    },
  );

  it('applies a distinct wrapper class per severity', () => {
    const severities: NotificationItem['variant'][] = [
      'error',
      'warning',
      'info',
      'success',
      'loading',
    ] as NotificationItem['variant'][];
    const classNames = severities.map((variant) => {
      notifications = [makeItem({ id: variant, variant })];
      const { unmount } = render(<NotificationContainer />);
      const className = screen.getByRole('alert').parentElement?.className;
      unmount();
      return className;
    });
    expect(new Set(classNames).size).toBe(severities.length);
  });

  it('renders one entry per stacked notification, in order', () => {
    notifications = [
      makeItem({ id: 'a', message: 'First' }),
      makeItem({ id: 'b', message: 'Second' }),
      makeItem({ id: 'c', message: 'Third' }),
    ];
    render(<NotificationContainer />);
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(3);
    expect(alerts[0].textContent).toContain('First');
    expect(alerts[1].textContent).toContain('Second');
    expect(alerts[2].textContent).toContain('Third');
  });

  it('renders the dismiss button by default (closable is always true for toasts)', () => {
    notifications = [makeItem({})];
    render(<NotificationContainer />);
    expect(
      screen.getByRole('button', { name: 'Close notification' }),
    ).toBeTruthy();
  });

  it('calls dismissNotification with the item id when the dismiss button is clicked', () => {
    notifications = [makeItem({ id: 'item-1' })];
    render(<NotificationContainer />);
    screen.getByRole('button', { name: 'Close notification' }).click();
    expect(dismissNotification).toHaveBeenCalledWith('item-1');
  });

  it('auto-dismisses after the fixed delay', () => {
    notifications = [makeItem({ id: 'item-1' })];
    render(<NotificationContainer />);
    expect(dismissNotification).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(dismissNotification).toHaveBeenCalledWith('item-1');
  });

  it('passes the title through unchanged when provided', () => {
    notifications = [makeItem({ title: 'Saved', message: 'Changes saved.' })];
    render(<NotificationContainer />);
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('Changes saved.')).toBeTruthy();
  });
});
