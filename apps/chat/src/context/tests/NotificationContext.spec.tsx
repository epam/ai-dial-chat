import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { NotificationProvider, useNotification } from '../NotificationContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationProvider>{children}</NotificationProvider>
);

const renderNotification = () =>
  renderHook(() => useNotification(), { wrapper });

describe('NotificationContext', () => {
  it('starts with no notifications', () => {
    const { result } = renderNotification();
    expect(result.current.notifications).toEqual([]);
  });

  it('showNotification appends an item with a generated id', () => {
    const { result } = renderNotification();
    act(() =>
      result.current.showNotification({
        variant: NotificationVariant.Info,
        message: 'hello',
      }),
    );
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].id).toBeTruthy();
  });

  it('dismissNotification removes the item by id', () => {
    const { result } = renderNotification();
    act(() =>
      result.current.showNotification({ variant: NotificationVariant.Info }),
    );
    const { id } = result.current.notifications[0];
    act(() => result.current.dismissNotification(id));
    expect(result.current.notifications).toEqual([]);
  });

  it.each([
    ['showInfoNotification', NotificationVariant.Info],
    ['showSuccessNotification', NotificationVariant.Success],
    ['showWarningNotification', NotificationVariant.Warning],
    ['showErrorNotification', NotificationVariant.Error],
    ['showLoadingNotification', NotificationVariant.Loading],
  ] as const)('%s shows a %s notification', (helper, variant) => {
    const { result } = renderNotification();
    act(() => result.current[helper]({ title: 'title', message: 'message' }));
    expect(result.current.notifications[0]).toMatchObject({
      variant,
      title: 'title',
      message: 'message',
    });
  });

  it('showErrorNotification forwards the requestId', () => {
    const { result } = renderNotification();
    act(() =>
      result.current.showErrorNotification({
        message: 'failed',
        requestId: 'a'.repeat(32),
      }),
    );
    expect(result.current.notifications[0].requestId).toBe('a'.repeat(32));
  });

  it('keeps the variant helpers referentially stable across renders', () => {
    const { result } = renderNotification();
    const before = result.current.showErrorNotification;
    act(() => result.current.showInfoNotification({ message: 'first' }));
    expect(result.current.showErrorNotification).toBe(before);
  });
});
