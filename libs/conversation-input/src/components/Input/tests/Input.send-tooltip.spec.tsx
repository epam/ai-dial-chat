import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationInput } from '../../ConversationInput/ConversationInput';
import { Input } from '../Input';

const tooltips = {
  sendTooltip: 'Send message',
  emptyMessageTooltip: 'Type a message first',
};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each([
  { name: 'Input', Component: Input },
  { name: 'ConversationInput', Component: ConversationInput },
])('$name send tooltip', ({ Component }) => {
  it.each(['', '   \n'])(
    'shows the empty hint for draft %j',
    async (message) => {
      const user = userEvent.setup({ delay: null });
      render(<Component {...tooltips} message={message} />);

      const send = screen.getByRole('button', { name: 'Send message' });
      expect(send).toHaveProperty('disabled', true);
      await user.hover(send);
      expect(await screen.findByText('Type a message first')).toBeTruthy();
    },
  );

  it.each(['', 'Hello'])(
    'preserves the regular tooltip without an override for draft %j',
    async (message) => {
      const user = userEvent.setup({ delay: null });
      render(<Component message={message} sendTooltip="Send message" />);

      await user.hover(screen.getByRole('button', { name: 'Send message' }));
      expect(await screen.findByText('Send message')).toBeTruthy();
      expect(screen.queryByText('Type a message first')).toBeNull();
    },
  );

  it('updates the tooltip while typing and clearing the draft', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Component {...tooltips} />);
    const textarea = screen.getByRole('textbox');
    const send = screen.getByRole('button', { name: 'Send message' });

    await user.hover(send);
    expect(await screen.findByText('Type a message first')).toBeTruthy();
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    expect(await screen.findByText('Send message')).toBeTruthy();
    expect(screen.queryByText('Type a message first')).toBeNull();
    fireEvent.change(textarea, { target: { value: '' } });
    expect(await screen.findByText('Type a message first')).toBeTruthy();
  });

  it('updates the tooltip after a programmatic message change', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<Component {...tooltips} />);
    await user.hover(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Type a message first')).toBeTruthy();

    rerender(<Component {...tooltips} message="Inserted prompt" />);
    expect(await screen.findByText('Send message')).toBeTruthy();
  });

  it('returns to the empty hint after sending', async () => {
    const user = userEvent.setup({ delay: null });
    const onSend = vi.fn();
    render(<Component {...tooltips} message="Hello" onSend={onSend} />);
    const send = screen.getByRole('button', { name: 'Send message' });
    await user.hover(send);
    expect(await screen.findByText('Send message')).toBeTruthy();

    fireEvent.click(send);
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Hello', []));
    expect(screen.getByRole('textbox')).toHaveProperty('value', '');
    expect(await screen.findByText('Type a message first')).toBeTruthy();
  });

  it('keeps the regular tooltip for a nonempty draft when sending is disabled', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Component {...tooltips} message="Hello" isSendDisabled />);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toHaveProperty('disabled', true);

    await user.hover(send);
    expect(await screen.findByText('Send message')).toBeTruthy();
    expect(screen.queryByText('Type a message first')).toBeNull();
  });

  it('keeps the regular tooltip when the model is missing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Component {...tooltips} message="Hello" deployments={[]} />);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toHaveProperty('disabled', true);
    await user.hover(send);
    expect(await screen.findByText('Send message')).toBeTruthy();
  });

  it('uses the regular tooltip for an inline skill without text', async () => {
    const user = userEvent.setup({ delay: null });
    render(
      <Component {...tooltips} inlineStartSlot={<span>Selected skill</span>} />,
    );
    await user.hover(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Send message')).toBeTruthy();
  });

  it('allows the host to suppress the empty tooltip', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Component sendTooltip="Send message" emptyMessageTooltip="" />);
    await user.hover(screen.getByRole('button', { name: 'Send message' }));
    expect(screen.queryByText('Send message')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

it.each([RequestStatus.Idle, RequestStatus.Loading, RequestStatus.Error])(
  'uses the regular tooltip for an attachment-only message with status %s',
  async (status) => {
    const user = userEvent.setup({ delay: null });
    render(
      <Input
        {...tooltips}
        initialAttachments={[
          {
            id: 'report',
            name: 'report.pdf',
            file: new File([], 'report.pdf', { type: 'application/pdf' }),
            type: AttachmentType.File,
            contentType: 'application/pdf',
            url: 'files/report.pdf',
            status,
          },
        ]}
      />,
    );
    await user.hover(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Send message')).toBeTruthy();
    expect(screen.queryByText('Type a message first')).toBeNull();
  },
);
