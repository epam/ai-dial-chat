import type { Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import { memo, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  SourcesSidebarProvider,
  useSourcesSidebar,
  useSourcesSidebarData,
} from '../SourcesSidebarContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SourcesSidebarProvider>{children}</SourcesSidebarProvider>
);

const useBoth = () => ({
  controls: useSourcesSidebar(),
  data: useSourcesSidebarData(),
});

const makeMessages = (): Message[] => [
  {
    id: '1',
    role: MessageRole.User,
    content: 'hello',
    timestamp: new Date().toISOString(),
  },
];

describe('SourcesSidebarContext', () => {
  it('starts closed with empty messages', () => {
    const { result } = renderHook(useBoth, { wrapper });
    expect(result.current.controls.isOpen).toBe(false);
    expect(result.current.data.messages).toEqual([]);
    expect(result.current.data.conversationModelId).toBeUndefined();
  });

  it('open() opens when closed', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    expect(result.current.isOpen).toBe(true);
  });

  it('close() closes when open', () => {
    const { result } = renderHook(() => useSourcesSidebar(), { wrapper });
    act(() => result.current.handleOpen());
    act(() => result.current.handleClose());
    expect(result.current.isOpen).toBe(false);
  });

  it('setMessages updates messages without changing isOpen', () => {
    const { result } = renderHook(useBoth, { wrapper });
    const messages = makeMessages();
    act(() => result.current.controls.setMessages(messages));
    expect(result.current.data.messages).toEqual(messages);
    expect(result.current.controls.isOpen).toBe(false);
  });

  it('setMessages([]) clears messages without changing isOpen', () => {
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.controls.handleOpen());
    act(() => result.current.controls.setMessages(makeMessages()));
    act(() => result.current.controls.setMessages([]));
    expect(result.current.data.messages).toEqual([]);
    expect(result.current.controls.isOpen).toBe(true);
  });

  it('setConversationModelId sets and clears the model id without changing isOpen', () => {
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.controls.handleOpen());
    act(() => result.current.controls.setConversationModelId('gpt-4o'));
    expect(result.current.data.conversationModelId).toBe('gpt-4o');
    expect(result.current.controls.isOpen).toBe(true);
    act(() => result.current.controls.setConversationModelId(undefined));
    expect(result.current.data.conversationModelId).toBeUndefined();
  });

  it('close() preserves messages', () => {
    const { result } = renderHook(useBoth, { wrapper });
    act(() => result.current.controls.handleOpen());
    const messages = makeMessages();
    act(() => result.current.controls.setMessages(messages));
    act(() => result.current.controls.handleClose());
    expect(result.current.controls.isOpen).toBe(false);
    expect(result.current.data.messages).toEqual(messages);
  });

  it('does not re-render a controls-only consumer when messages change', () => {
    const onControlsRender = vi.fn();
    /* memo so only a context change, not the parent, can re-render it. */
    const ControlsConsumer = memo(() => {
      onControlsRender();
      useSourcesSidebar();
      return null;
    });
    const Publisher = () => {
      const { setMessages } = useSourcesSidebar();
      return (
        <button onClick={() => setMessages(makeMessages())}>publish</button>
      );
    };
    render(
      <SourcesSidebarProvider>
        <ControlsConsumer />
        <Publisher />
      </SourcesSidebarProvider>,
    );
    onControlsRender.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'publish' }));

    expect(onControlsRender).not.toHaveBeenCalled();
  });

  it('re-renders a data consumer with the new messages', () => {
    const { result } = renderHook(useBoth, { wrapper });
    const messages = makeMessages();

    act(() => result.current.controls.setMessages(messages));

    expect(result.current.data.messages).toBe(messages);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useSourcesSidebar())).toThrow(
      /SourcesSidebarProvider/,
    );
  });

  it('throws when the data hook is used outside provider', () => {
    expect(() => renderHook(() => useSourcesSidebarData())).toThrow(
      /SourcesSidebarProvider/,
    );
  });
});
