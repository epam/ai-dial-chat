import { VisualizerConnectorRequests } from '@epam/ai-dial-shared';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  GroupedVisualizerCanvasContent,
  VisualizerCanvasContent,
} from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import {
  type VisualizerCanvasRendererProps,
  VisualizerCanvasRenderer,
} from '../VisualizerCanvasRenderer';

const readyMock = vi.fn();
const sendMock = vi.fn();
const destroyMock = vi.fn();
let lastConstructorRoot: HTMLElement | undefined;
let lastConstructorOptions: Record<string, unknown> | undefined;

vi.mock('@epam/ai-dial-visualizer-connector', () => ({
  VisualizerConnector: vi.fn().mockImplementation(function (
    root: HTMLElement,
    options: Record<string, unknown>,
  ) {
    lastConstructorRoot = root;
    lastConstructorOptions = options;
    return {
      ready: readyMock,
      send: sendMock,
      destroy: destroyMock,
    };
  }),
}));

const content: VisualizerCanvasContent = {
  type: AttachmentContentType.Visualizer,
  url: 'https://viz.example.com',
  mimeType: 'application/x-my-viz',
  data: { series: [1, 2, 3] },
  layout: { themeId: 'dark' },
  visualizerName: 'my-viz',
  requestTimeout: 15000,
};

describe('VisualizerCanvasRenderer', () => {
  const renderComponent = (props?: Partial<VisualizerCanvasRendererProps>) =>
    render(<VisualizerCanvasRenderer content={content} {...props} />);

  beforeEach(() => {
    vi.clearAllMocks();
    lastConstructorRoot = undefined;
    lastConstructorOptions = undefined;
  });

  it('mounts a VisualizerConnector with the content-derived options', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    renderComponent();

    expect(lastConstructorOptions).toMatchObject({
      domain: content.url,
      hostDomain: window.location.origin,
      visualizerName: content.visualizerName,
      requestTimeout: content.requestTimeout,
    });
    expect(lastConstructorRoot).toBeInstanceOf(HTMLElement);
  });

  it('calls send with the layout and payload after ready resolves', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);

    renderComponent();

    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());
    expect(sendMock).toHaveBeenCalledWith(
      VisualizerConnectorRequests.sendVisualizeData,
      {
        mimeType: content.mimeType,
        visualizerData: {
          layout: content.layout,
          series: [1, 2, 3],
        },
      },
    );
  });

  it('destroys the connector on unmount', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));
    const { unmount } = renderComponent();

    unmount();

    expect(destroyMock).toHaveBeenCalledOnce();
  });

  it('shows an error state when send rejects', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockRejectedValue(new Error('timed out'));

    renderComponent({ errorLabel: 'Failed to load visualizer' });

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('shows an error state when ready rejects', async () => {
    readyMock.mockRejectedValue(new Error('connection refused'));

    renderComponent({ errorLabel: 'Failed to load visualizer' });

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('stays in the loading state (no error) when ready never settles', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));

    renderComponent({ errorLabel: 'Failed to load visualizer' });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('VisualizerCanvasRenderer — grouped content', () => {
  const groupedContent: GroupedVisualizerCanvasContent = {
    type: AttachmentContentType.GroupedVisualizer,
    url: 'https://viz.example.com',
    attachments: [
      {
        url: 'https://files.example.com/a.json',
        mimeType: 'application/x-a',
        visualizerData: { layout: { themeId: 'dark' } },
      },
      {
        url: 'https://files.example.com/b.json',
        mimeType: 'application/x-b',
        visualizerData: { layout: { themeId: 'dark' } },
      },
    ],
    layout: { themeId: 'dark', height: 600 },
    visualizerName: 'my-viz',
    requestTimeout: 15000,
  };

  const renderGrouped = (props?: Partial<VisualizerCanvasRendererProps>) =>
    render(<VisualizerCanvasRenderer content={groupedContent} {...props} />);

  beforeEach(() => {
    vi.clearAllMocks();
    lastConstructorRoot = undefined;
    lastConstructorOptions = undefined;
  });

  it('sends SEND_GROUPED_VISUALIZE_DATA exactly once after ready resolves', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);

    renderGrouped();

    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());
    expect(sendMock).toHaveBeenCalledWith(
      VisualizerConnectorRequests.sendGroupedVisualizeData,
      {
        attachments: groupedContent.attachments,
        layout: groupedContent.layout,
      },
    );
  });

  it('does not send the single-attachment request for grouped content', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);

    renderGrouped();

    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());
    expect(sendMock).not.toHaveBeenCalledWith(
      VisualizerConnectorRequests.sendVisualizeData,
      expect.anything(),
    );
  });

  it('mounts the connector with the grouped content-derived options', () => {
    readyMock.mockReturnValue(new Promise(() => undefined));

    renderGrouped();

    expect(lastConstructorOptions).toMatchObject({
      domain: groupedContent.url,
      visualizerName: groupedContent.visualizerName,
      requestTimeout: groupedContent.requestTimeout,
    });
  });

  it('does not remount the iframe when only the attachments identity changes', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockResolvedValue(undefined);

    const { rerender } = renderGrouped();
    await waitFor(() => expect(sendMock).toHaveBeenCalledOnce());

    rerender(
      <VisualizerCanvasRenderer
        content={{
          ...groupedContent,
          attachments: [...groupedContent.attachments],
        }}
      />,
    );

    expect(destroyMock).not.toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledOnce();
  });

  it('shows an error state when the grouped send rejects', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockRejectedValue(new Error('timed out'));

    renderGrouped({ errorLabel: 'Failed to load visualizer' });

    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
