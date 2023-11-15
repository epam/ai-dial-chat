import { PlaybackControls } from '@/src/components/Chat/PlaybackControls';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FooterMessage } from '@/src/components/Chat/FooterMessage';
import { ScrollDownButton } from '@/src/components/Chat/ScrollDownButton';
import { Conversation } from '@/src/types/chat';
vi.mock('@/src/components/Chat/FooterMessage', ()=>({
    FooterMessage: () => <div data-qa="footer-message">footer</div>
}));

vi.mock("@/src/store/hooks", async () => {
  const actual:any = await vi.importActual("@/src/store/hooks")
  return {
    ...actual,
    useAppSelector: (selector:any) => selector({}),
    useAppDispatch: () => (action:any) => action
  }
})
vi.mock('@/src/store/conversations/conversations.reducers', async () => {
  const actual:any = await vi.importActual('@/src/store/conversations/conversations.reducers')
  return {
    ...actual,
    ConversationsActions: {
      playbackPrevMessage: vi.fn(),
      playbackNextMessageStart: vi.fn()
    },
    ConversationsSelectors: {
      selectIsPlaybackSelectedConversations: vi.fn(),
      selectSelectedConversations: vi.fn(),
      selectIsConversationsStreaming: vi.fn(),
      selectPlaybackActiveIndex: vi.fn(),
    }
  }
});

window.ResizeObserver =
    window.ResizeObserver ||
    vi.fn().mockImplementation(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
    }));

describe('PlaybackControls', () => {
  const onScrollDownClick = vi.fn();
  const onResize = vi.fn();
  const nextMessageBoxRef = { current: null } as any;

  // cleanup
  beforeEach(() => {
    vi.mocked(ConversationsSelectors.selectIsPlaybackSelectedConversations).mockReturnValue(true);
    vi.mocked(ConversationsSelectors.selectIsConversationsStreaming).mockReturnValue(false);
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(1);
    vi.mocked(ConversationsSelectors.selectSelectedConversations).mockReturnValue([
        {
          id: '1',
          name: '1',
          playback: {
            isPlayback: true,
            messagesStack: [{
              content: 'test1',
              role: 'user'
            },{
              content: 'test2',
              role: 'assistant'
            },{
              content: 'test3',
              role: 'user'
            }],
          }
        },
      ]);
  });

   it('renders properly', () => {
    const { getByTestId, getAllByRole, queryByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const footer = getByTestId('footer-message');
    const scrollDownButton = getByTestId('scroll-down-button');
    const buttons = getAllByRole('button');
    const messageBox = getByTestId('playback-message-content');
    const spinner = queryByTestId('message-input-spinner');

    expect(buttons.length).toBe(3);
    expect(messageBox).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(scrollDownButton).toBeInTheDocument();
    expect(spinner).toBeNull();
   });

   it('displays spinner if streaming', () => {
    vi.mocked(ConversationsSelectors.selectIsConversationsStreaming).mockReturnValue(true);
    const { queryByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const spinner = queryByTestId('message-input-spinner');
    const messageBox = queryByTestId('playback-message-content');

    expect(messageBox).toBeNull();
    expect(spinner).toBeInTheDocument();
   });

   it('hides scroll down button', () => {
    vi.mocked(ConversationsSelectors.selectIsConversationsStreaming).mockReturnValue(true);
    const { queryByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={false}
      />,
    );
    const scrollDownButton = queryByTestId('scroll-down-button');

    expect(scrollDownButton).toBeNull();
   });

   it('handles clicking on the scroll down button', async () => {
    const onScrollDownClick = vi.fn();
    const { getByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const scrollDownButton = getByTestId('scroll-down-button');

    await userEvent.click(scrollDownButton);
    expect(onScrollDownClick).toHaveBeenCalledOnce();
   });

  it('handles clicking on the previous message button', async () => {
    const playbackPrevMessage = vi.fn();
    vi.mocked(ConversationsActions.playbackPrevMessage).mockImplementation(playbackPrevMessage);
    const { getByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={true}
      />,
    );
    const prevBtn = getByTestId('playback-prev');

    await userEvent.click(prevBtn);

    expect(playbackPrevMessage).toHaveBeenCalledOnce();
  });

  it('doesn\'t allow clicking on the previous message button if first message', async () => {
    const playbackPrevMessage = vi.fn();
    vi.mocked(ConversationsActions.playbackPrevMessage).mockImplementation(playbackPrevMessage);
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(0);
    const { getByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={true}
      />,
    );
    const prevBtn = getByTestId('playback-prev');

    await userEvent.click(prevBtn);

    expect(playbackPrevMessage).not.toHaveBeenCalled();
  });

  it('handles clicking on the next message button', async () => {
    const playbackNextMessageStart = vi.fn();
    vi.mocked(ConversationsActions.playbackNextMessageStart).mockImplementation(playbackNextMessageStart);
    const { getByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={true}
      />,
    );
    const nextBtn = getByTestId('playback-next');

    await userEvent.click(nextBtn);

    expect(playbackNextMessageStart).toHaveBeenCalledOnce();
  });

  it('doesn\'t allow clicking on the next message button if last message was sent', async () => {
    const playbackNextMessageStart = vi.fn();
    vi.mocked(ConversationsActions.playbackNextMessageStart).mockImplementation(playbackNextMessageStart);
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(3);
    const { getByTestId } = render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={true}
      />,
    );
    const nextBtn = getByTestId('playback-next');

    await userEvent.click(nextBtn);

    expect(playbackNextMessageStart).not.toHaveBeenCalled();
  });
});
