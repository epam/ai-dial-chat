import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
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
  DIAL_ICON_SIZE: { SM: 16, LG: 24 },
  NotificationVariant: {
    Error: 'error',
    Warning: 'warning',
    Info: 'info',
    Success: 'success',
    Loading: 'loading',
  },
  Notification: ({
    variant,
    title,
    message,
    closable,
    onClose,
  }: {
    variant: string;
    title?: string;
    message: ReactNode;
    closable?: boolean;
    onClose?: () => void;
  }) => (
    /* The kit reserves the assertive `alert` role for error/warning; the rest are polite. */
    <div
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      data-variant={variant}
    >
      {title && <div>{title}</div>}
      <div>{message}</div>
      {closable && <button aria-label="Close notification" onClick={onClose} />}
    </div>
  ),
  GhostIconButton: ({
    icon,
    onClick,
    ...rest
  }: {
    icon?: ReactNode;
    onClick?: () => void;
    'aria-label'?: string;
  }) => (
    <button onClick={onClick} {...rest}>
      {icon}
    </button>
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
      const role =
        variant === 'error' || variant === 'warning' ? 'alert' : 'status';
      expect(screen.getByRole(role).getAttribute('data-variant')).toBe(variant);
    },
  );

  it('renders one entry per stacked notification, in order', () => {
    notifications = [
      makeItem({ id: 'a', message: 'First' }),
      makeItem({ id: 'b', message: 'Second' }),
      makeItem({ id: 'c', message: 'Third' }),
    ];
    render(<NotificationContainer />);
    const alerts = screen.getAllByRole('status');
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

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

describe('NotificationContainer — Request ID dismiss timing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    notifications = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no Request ID row when requestId is absent', () => {
    notifications = [makeItem({ message: 'Plain error' })];
    render(<NotificationContainer />);
    expect(
      screen.queryByRole('button', {
        name: 'notification.requestId.copyAriaLabel',
      }),
    ).toBeNull();
  });

  it('does not auto-dismiss a trace-bearing notification', () => {
    notifications = [makeItem({ id: 'trace-1', requestId: TRACE_ID })];
    render(<NotificationContainer />);

    vi.advanceTimersByTime(10000);

    expect(dismissNotification).not.toHaveBeenCalled();
  });

  it('keeps auto-dismiss for non-trace notifications alongside a trace-bearing one', () => {
    notifications = [
      makeItem({ id: 'plain-1' }),
      makeItem({ id: 'trace-1', requestId: TRACE_ID }),
    ];
    render(<NotificationContainer />);

    vi.advanceTimersByTime(5000);

    expect(dismissNotification).toHaveBeenCalledWith('plain-1');
    expect(dismissNotification).not.toHaveBeenCalledWith('trace-1');
  });
});

describe('NotificationContainer — Request ID row and Copy control', () => {
  const mockWriteText = vi.fn();

  /*
   * `navigator.clipboard` must be (re)stubbed AFTER `userEvent.setup()` runs — user-event
   * installs its own clipboard stub during setup, which silently shadows ours if we stub first
   * (0 calls to `mockWriteText` even though the component reads `navigator.clipboard`).
   */
  const setupUser = () => {
    const user = userEvent.setup({ delay: null });
    mockWriteText.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mockWriteText },
    });
    return user;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    notifications = [];
  });

  it('renders the Request ID row with the value forced to LTR', () => {
    notifications = [makeItem({ message: 'Save failed', requestId: TRACE_ID })];
    render(<NotificationContainer />);

    const value = screen.getByText(TRACE_ID);
    expect(value.getAttribute('dir')).toBe('ltr');
    expect(
      screen.getByRole('button', {
        name: 'notification.requestId.copyAriaLabel',
      }),
    ).toBeTruthy();
  });

  it('copies exactly the trace ID and announces success without a new notification', async () => {
    const user = setupUser();
    mockWriteText.mockResolvedValue(undefined);
    notifications = [makeItem({ requestId: TRACE_ID })];
    render(<NotificationContainer />);

    await user.click(
      screen.getByRole('button', {
        name: 'notification.requestId.copyAriaLabel',
      }),
    );

    expect(mockWriteText).toHaveBeenCalledWith(TRACE_ID);
    expect(
      await screen.findByText('notification.requestId.copiedStatus'),
    ).toBeTruthy();
    /* The copy announcement is its own `status` region, so count notification
     * bodies rather than roles to assert no second notification was pushed. */
    expect(screen.getAllByText('Test message')).toHaveLength(1);
  });

  it('is keyboard accessible via Enter', async () => {
    const user = setupUser();
    mockWriteText.mockResolvedValue(undefined);
    notifications = [makeItem({ requestId: TRACE_ID })];
    render(<NotificationContainer />);

    screen
      .getByRole('button', { name: 'notification.requestId.copyAriaLabel' })
      .focus();
    await user.keyboard('{Enter}');

    expect(mockWriteText).toHaveBeenCalledWith(TRACE_ID);
  });

  it('announces failure without dismissing the notification when the clipboard write rejects', async () => {
    const user = setupUser();
    mockWriteText.mockRejectedValue(new Error('denied'));
    notifications = [makeItem({ id: 'trace-1', requestId: TRACE_ID })];
    render(<NotificationContainer />);

    await user.click(
      screen.getByRole('button', {
        name: 'notification.requestId.copyAriaLabel',
      }),
    );

    expect(
      await screen.findByText('notification.requestId.copyFailedStatus'),
    ).toBeTruthy();
    expect(dismissNotification).not.toHaveBeenCalled();
  });
});
