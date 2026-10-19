import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-visualizer-connector';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomViewerI18nKeys } from '../../../constants/translation-keys';
import type { CustomViewer } from '../../../models/custom-viewer';
import CustomViewerFrame from '../CustomViewerFrame';

const readyMock = vi.fn();
const sendMock = vi.fn();
const destroyMock = vi.fn();
const subscriptions = new Map<string, (payload: unknown) => void>();
const subscribeMock = vi.fn(
  (eventType: string, callback: (payload: unknown) => void) => {
    subscriptions.set(eventType, callback);
    return () => subscriptions.delete(eventType);
  },
);
let lastOptions: Record<string, unknown> | undefined;

vi.mock('@epam/ai-dial-visualizer-connector', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@epam/ai-dial-visualizer-connector')
  >()),
  VisualizerConnector: vi.fn().mockImplementation(function (
    root: HTMLElement,
    options: Record<string, unknown>,
  ) {
    lastOptions = options;
    root.appendChild(document.createElement('iframe'));
    return {
      ready: readyMock,
      send: sendMock,
      destroy: destroyMock,
      subscribe: subscribeMock,
    };
  }),
}));

const themeState = { currentTheme: 'light' };
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => themeState,
}));
vi.mock('../../../context/auth/UserContext', () => ({
  useUser: () => ({ user: { providerId: 'keycloak' } }),
}));
vi.mock('../../../hooks/language/useLanguage', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../../../hooks/language/useLanguage')
  >()),
  useLanguage: () => ({ language: 'en' }),
}));

const viewer: CustomViewer = {
  url: 'https://viewer.example.com/',
  title: 'Explorer',
  applicationId: 'applications/bucket/explorer',
};

const createdEvent = `Explorer/${VisualizerConnectorEvents.CreatedConversationSuccess}`;
const updatedEvent = `Explorer/${VisualizerConnectorEvents.UpdatedConversationSuccess}`;

describe('CustomViewerFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscriptions.clear();
    lastOptions = undefined;
    themeState.currentTheme = 'light';
    sendMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading status until the viewer is ready', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    render(<CustomViewerFrame viewer={viewer} />);

    /* The kit Spinner is an unnamed status region around a labelled image. */
    expect(screen.getByRole('status')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: CustomViewerI18nKeys.Loading }),
    ).toBeTruthy();
  });

  it('mounts the connector with the viewer URL and title namespace', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    render(
      <CustomViewerFrame viewer={viewer} conversationId="conversations/b/c" />,
    );

    const domain = new URL(String(lastOptions?.domain));
    expect(domain.origin).toBe('https://viewer.example.com');
    expect(domain.searchParams.get('conversationId')).toBe('conversations/b/c');
    expect(domain.searchParams.get('authProvider')).toBe('keycloak');
    expect(lastOptions?.visualizerName).toBe('Explorer');
    expect(screen.getByTitle(CustomViewerI18nKeys.FrameTitle)).toBeTruthy();
  });

  it('sends the visualize data once after the handshake', async () => {
    readyMock.mockResolvedValue(true);
    render(
      <CustomViewerFrame viewer={viewer} conversationId="conversations/b/c" />,
    );

    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());
    expect(sendMock).toHaveBeenCalledWith(
      VisualizerConnectorRequests.SendVisualizeData,
      {
        mimeType: 'application/json',
        visualizerData: {
          isPreview: false,
          conversationId: 'conversations/b/c',
          layout: {
            width: 0,
            height: 0,
            themeId: 'light',
            currentLocale: 'en',
            dir: 'ltr',
          },
        },
      },
    );
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('re-sends the data with the new theme after a theme change', async () => {
    readyMock.mockResolvedValue(true);
    const { rerender } = render(<CustomViewerFrame viewer={viewer} />);
    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());

    themeState.currentTheme = 'dark';
    /* A new viewer object forces the memoised frame to re-render with the new theme. */
    rerender(<CustomViewerFrame viewer={{ ...viewer }} />);

    await waitFor(() =>
      expect(sendMock).toHaveBeenLastCalledWith(
        VisualizerConnectorRequests.SendVisualizeData,
        expect.objectContaining({
          visualizerData: expect.objectContaining({
            layout: expect.objectContaining({ themeId: 'dark' }),
          }),
        }),
      ),
    );
  });

  it('reports created and updated conversation ids', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    const onConversationCreated = vi.fn();
    const onConversationUpdated = vi.fn();
    render(
      <CustomViewerFrame
        viewer={viewer}
        onConversationCreated={onConversationCreated}
        onConversationUpdated={onConversationUpdated}
      />,
    );

    act(() => {
      subscriptions.get(createdEvent)?.({ conversation: { id: 'c-1' } });
      subscriptions.get(updatedEvent)?.({ conversation: { id: 'c-1' } });
    });

    expect(onConversationCreated).toHaveBeenCalledWith('c-1');
    expect(onConversationUpdated).toHaveBeenCalledWith('c-1');
  });

  it('ignores an event without a conversation id', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onConversationCreated = vi.fn();
    render(
      <CustomViewerFrame
        viewer={viewer}
        onConversationCreated={onConversationCreated}
      />,
    );

    act(() => {
      subscriptions.get(createdEvent)?.({});
      subscriptions.get(createdEvent)?.({ conversation: { id: 42 } });
    });

    expect(onConversationCreated).not.toHaveBeenCalled();
  });

  it('collapses a burst of the same event within 300 ms into one callback', () => {
    vi.useFakeTimers();
    readyMock.mockReturnValue(new Promise(() => undefined));
    const onConversationUpdated = vi.fn();
    render(
      <CustomViewerFrame
        viewer={viewer}
        onConversationUpdated={onConversationUpdated}
      />,
    );

    act(() => {
      subscriptions.get(updatedEvent)?.({ conversation: { id: 'c-1' } });
      vi.advanceTimersByTime(100);
      subscriptions.get(updatedEvent)?.({ conversation: { id: 'c-1' } });
      vi.advanceTimersByTime(100);
      subscriptions.get(updatedEvent)?.({ conversation: { id: 'c-1' } });
    });

    expect(onConversationUpdated).toHaveBeenCalledOnce();
  });

  it('renders an alert instead of an iframe for an invalid viewer URL', () => {
    render(
      <CustomViewerFrame viewer={{ ...viewer, url: 'javascript:alert(1)' }} />,
    );

    expect(screen.getByRole('alert').textContent).toBe(
      CustomViewerI18nKeys.InvalidUrl,
    );
    expect(lastOptions).toBeUndefined();
  });

  it('destroys the connector on unmount', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    const { unmount } = render(<CustomViewerFrame viewer={viewer} />);

    unmount();

    expect(destroyMock).toHaveBeenCalledOnce();
  });
});
