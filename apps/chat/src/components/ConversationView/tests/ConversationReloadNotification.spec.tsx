import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatI18nKeys } from '../../../constants/translation-keys';
import { ConversationReloadNotification } from '../ConversationReloadNotification';

describe('ConversationReloadNotification', () => {
  it('shows a read failure and offers a keyboard-accessible read retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <ConversationReloadNotification
        isReloading={false}
        isStreaming={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText(ChatI18nKeys.ConversationReloadError)).toBeTruthy();
    /* The host view owns the always-mounted live region for this message. */
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(ChatI18nKeys.StreamErrorTitle)).toBeNull();
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it.each([
    { isReloading: true, isStreaming: false },
    { isReloading: false, isStreaming: true },
  ])(
    'keeps the notification and prevents retry while busy (%j)',
    async (state) => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(
        <div dir="rtl">
          <ConversationReloadNotification {...state} onRetry={onRetry} />
        </div>,
      );
      const button = screen.getByRole('button', {
        name: ChatI18nKeys.RetryConversationReload,
      });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      await user.click(button);
      expect(onRetry).not.toHaveBeenCalled();
      expect(
        screen.getByText(ChatI18nKeys.ConversationReloadErrorTitle),
      ).toBeTruthy();
    },
  );
});
