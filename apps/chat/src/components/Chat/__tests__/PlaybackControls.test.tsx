import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { MutableRefObject } from 'react';

import { AnyAction } from '@reduxjs/toolkit';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { PlaybackControls } from '@/src/components/Chat/Playback/PlaybackControls';

import { Role } from '@epam/ai-dial-shared';

vi.mock('@/src/components/Common/FooterMessage', () => ({
  FooterMessage: () => <div data-qa="footer-message">footer</div>,
}));

vi.mock('@/src/store/hooks', async () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppSelector: (selector: any) => selector({}),
    useAppDispatch: () => (action: AnyAction) => action,
  };
});
vi.mock('@/src/store/conversations/conversations.reducers', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual(
    '@/src/store/conversations/conversations.reducers',
  );
  return {
    ...actual,
    ConversationsActions: {
      playbackPrevMessage: vi.fn(),
      playbackNextMessageStart: vi.fn(),
    },
    ConversationsSelectors: {
      selectIsPlaybackSelectedConversations: vi.fn(),
      selectSelectedConversations: vi.fn(),
      selectIsConversationsStreaming: vi.fn(),
      selectPlaybackActiveIndex: vi.fn(),
    },
  };
});

vi.mock('@/src/store/ui/ui.reducers', async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await vi.importActual('@/src/store/ui/ui.reducers');
  return {
    ...actual,
    UISelectors: {
      selectIsChatFullWidth: vi.fn(),
    },
  };
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
  const nextMessageBoxRef: MutableRefObject<HTMLDivElement | null> = {
    current: null,
  };

  // cleanup
  beforeEach(() => {
    vi.mocked(
      ConversationsSelectors.selectIsPlaybackSelectedConversations,
    ).mockReturnValue(true);
    vi.mocked(
      ConversationsSelectors.selectIsConversationsStreaming,
    ).mockReturnValue(false);
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(
      1,
    );
    vi.mocked(
      ConversationsSelectors.selectSelectedConversations,
    ).mockReturnValue([
      {
        id: '1',
        name: '1',
        folderId: 'conversations/Test',
        playback: {
          isPlayback: true,
          messagesStack: [
            {
              content: 'test1',
              role: Role.User,
            },
            {
              content: 'test2',
              role: Role.Assistant,
            },
            {
              content: 'test3',
              role: Role.User,
            },
          ],
          activePlaybackIndex: 1,
        },
        model: {
          id: 'gpt-4-0613',
        },
        messages: [],
        prompt: '',
        temperature: 1,
        replay: {
          isReplay: false,
          replayUserMessagesStack: [],
          activeReplayIndex: 0,
          replayAsIs: false,
        },
        selectedAddons: [],
        isMessageStreaming: false,
      },
    ]);
    vi.mocked(UISelectors.selectIsChatFullWidth).mockReturnValue(false);
  });

  it('renders properly', () => {
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const footer = screen.getByTestId('footer-message');
    const scrollDownButton = screen.getByTestId('scroll-down-button');
    const buttons = screen.getAllByRole('button');
    const messageBox = screen.getByTestId('playback-message-content');
    const spinner = screen.queryByTestId('message-input-spinner');

    expect(buttons.length).toBe(3);
    expect(messageBox).toBeInTheDocument();
    expect(footer).toBeVisible();
    expect(scrollDownButton).toBeInTheDocument();
    expect(spinner).toBeNull();
  });

  it('displays spinner if streaming', () => {
    vi.mocked(
      ConversationsSelectors.selectIsConversationsStreaming,
    ).mockReturnValue(true);
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const spinner = screen.getByTestId('message-input-spinner');
    const messageBox = screen.queryByTestId('playback-message-content');

    expect(messageBox).toBeNull();
    expect(spinner).toBeInTheDocument();
  });

  it('hides scroll down button', () => {
    vi.mocked(
      ConversationsSelectors.selectIsConversationsStreaming,
    ).mockReturnValue(true);
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton={false}
      />,
    );
    const scrollDownButton = screen.queryByTestId('scroll-down-button');

    expect(scrollDownButton).toBeNull();
  });

  it('handles clicking on the scroll down button', async () => {
    const onScrollDownClick = vi.fn();
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const scrollDownButton = screen.getByTestId('scroll-down-button');

    await userEvent.click(scrollDownButton);
    expect(onScrollDownClick).toHaveBeenCalledOnce();
  });

  it("clicking on previous message button should show placeholder 'Type a message'", async () => {
    const playbackPrevMessage = vi.fn();
    vi.mocked(ConversationsActions.playbackPrevMessage).mockImplementation(
      playbackPrevMessage,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const prevBtn = screen.getByTestId('playback-prev');
    const controlContent = screen.getByTestId(
      'playback-message-content',
    )?.textContent;

    await userEvent.click(prevBtn);

    expect(playbackPrevMessage).not.toHaveBeenCalled();
    expect(controlContent).eq('Type a message');
  });

  it('handles clicking on the previous message button', async () => {
    const playbackPrevMessage = vi.fn();
    vi.mocked(ConversationsActions.playbackPrevMessage).mockImplementation(
      playbackPrevMessage,
    );
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(
      2,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const prevBtn = screen.getByTestId('playback-prev');

    await userEvent.click(prevBtn);
    await userEvent.click(prevBtn);

    expect(playbackPrevMessage).toHaveBeenCalledOnce();
  });

  it("doesn't allow clicking on the previous message button if first message", async () => {
    const playbackPrevMessage = vi.fn();
    vi.mocked(ConversationsActions.playbackPrevMessage).mockImplementation(
      playbackPrevMessage,
    );
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(
      0,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const prevBtn = screen.getByTestId('playback-prev');

    await userEvent.click(prevBtn);

    expect(playbackPrevMessage).not.toHaveBeenCalled();
  });

  it('handles clicking on the next message button', async () => {
    const playbackNextMessageStart = vi.fn();
    vi.mocked(ConversationsActions.playbackNextMessageStart).mockImplementation(
      playbackNextMessageStart,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const nextBtn = screen.getByTestId('playback-next');
    const controlContent = screen.getByTestId(
      'playback-message-content',
    )?.textContent;

    await userEvent.click(nextBtn);

    expect(playbackNextMessageStart).not.toHaveBeenCalled();
    expect(controlContent).eq('Type a message');
  });

  it('handles clicking on the next message button', async () => {
    const playbackNextMessageStart = vi.fn();
    vi.mocked(ConversationsActions.playbackNextMessageStart).mockImplementation(
      playbackNextMessageStart,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const nextBtn = screen.getByTestId('playback-next');

    await userEvent.click(nextBtn);
    await userEvent.click(nextBtn);

    expect(playbackNextMessageStart).toHaveBeenCalledOnce();
  });

  it("doesn't allow clicking on the next message button if last message was sent", async () => {
    const playbackNextMessageStart = vi.fn();
    vi.mocked(ConversationsActions.playbackNextMessageStart).mockImplementation(
      playbackNextMessageStart,
    );
    vi.mocked(ConversationsSelectors.selectPlaybackActiveIndex).mockReturnValue(
      3,
    );
    render(
      <PlaybackControls
        onScrollDownClick={onScrollDownClick}
        onResize={onResize}
        nextMessageBoxRef={nextMessageBoxRef}
        showScrollDownButton
      />,
    );
    const nextBtn = screen.getByTestId('playback-next');

    await userEvent.click(nextBtn);

    expect(playbackNextMessageStart).not.toHaveBeenCalled();
  });
});
