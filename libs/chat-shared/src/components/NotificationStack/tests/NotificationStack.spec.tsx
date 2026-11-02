import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationStack,
  type NotificationStackItem,
} from '../NotificationStack';

const item = (
  overrides: Partial<NotificationStackItem> = {},
): NotificationStackItem => ({
  id: 'n1',
  variant: NotificationVariant.Success,
  message: 'Saved',
  ...overrides,
});

describe('NotificationStack', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing without items', () => {
    render(<NotificationStack items={[]} onDismiss={vi.fn()} />);

    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('auto-dismisses a plain toast after the delay', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <NotificationStack
        items={[item()]}
        onDismiss={onDismiss}
        dismissDelayMs={100}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onDismiss).toHaveBeenCalledWith('n1');
  });

  it('keeps a request-id toast and renders the request id with English defaults', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(
      <NotificationStack
        items={[item({ requestId: 'abc123' })]}
        onDismiss={onDismiss}
        dismissDelayMs={100}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Request ID:')).toBeTruthy();
    expect(screen.getByText('abc123')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Copy request ID' }),
    ).toBeTruthy();
  });

  it('uses host labels', () => {
    render(
      <NotificationStack
        items={[item({ requestId: 'abc123' })]}
        onDismiss={vi.fn()}
        labels={{
          requestId: 'ID запроса',
          copyRequestIdAriaLabel: 'Копировать',
          close: 'Закрыть',
        }}
      />,
    );

    expect(screen.getByText('ID запроса:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Копировать' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeTruthy();
  });
});
