import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupedVisualizerCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import {
  InlineGroupedVisualizer,
  type InlineGroupedVisualizerProps,
} from '../InlineGroupedVisualizer';

const readyMock = vi.fn();
const sendMock = vi.fn();
const destroyMock = vi.fn();

vi.mock('@epam/ai-dial-visualizer-connector', () => ({
  VisualizerConnector: vi.fn().mockImplementation(function (root: HTMLElement) {
    /* The real connector creates the iframe itself; the renderer titles that
     * node, so the fake has to create one too for the name to be assertable. */
    const iframe = document.createElement('iframe');
    root.appendChild(iframe);
    return { ready: readyMock, send: sendMock, destroy: destroyMock };
  }),
}));

const content: GroupedVisualizerCanvasContent = {
  type: AttachmentContentType.GroupedVisualizer,
  url: 'https://viz.example.com',
  attachments: [
    {
      url: 'https://files.example.com/a.json',
      mimeType: 'application/x-a',
      visualizerData: { layout: { themeId: 'light' } },
    },
  ],
  layout: { themeId: 'light', height: 480 },
  visualizerName: 'my-viz',
};

describe('InlineGroupedVisualizer', () => {
  const renderComponent = (props?: Partial<InlineGroupedVisualizerProps>) =>
    render(
      <InlineGroupedVisualizer
        content={content}
        height={480}
        onExpand={vi.fn()}
        expandAriaLabel="Expand app"
        {...props}
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    readyMock.mockReturnValue(new Promise(() => undefined));
  });

  it('renders the entry title in the header', () => {
    renderComponent();

    expect(screen.getByText('my-viz')).toBeTruthy();
  });

  it('sizes the iframe area to the supplied height', () => {
    const { container } = renderComponent({ height: 320 });

    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting an inline pixel height on the unlabeled frame wrapper, which has no accessible role or text to query
    const sized = container.querySelector('[style*="height: 320px"]');

    expect(sized).toBeTruthy();
  });

  it('exposes the expand button with its accessible name', () => {
    renderComponent({ expandAriaLabel: 'Open in canvas' });

    expect(screen.getByRole('button', { name: 'Open in canvas' })).toBeTruthy();
  });

  it('calls onExpand when the expand button is activated', async () => {
    const onExpand = vi.fn();
    renderComponent({ onExpand });

    await userEvent.click(screen.getByRole('button', { name: 'Expand app' }));

    expect(onExpand).toHaveBeenCalledOnce();
  });

  it('names the actions group', () => {
    renderComponent();

    expect(
      screen.getByRole('toolbar', { name: 'Visualizer actions' }),
    ).toBeTruthy();
  });

  it('titles the iframe with the visualizer name', () => {
    renderComponent();

    expect(screen.getByTitle('my-viz')).toBeTruthy();
  });

  it('prefers an explicit frameTitle over the visualizer name', () => {
    renderComponent({ frameTitle: 'Plotly figure' });

    expect(screen.getByTitle('Plotly figure')).toBeTruthy();
    expect(screen.queryByTitle('my-viz')).toBeNull();
  });

  it('leaves the iframe untitled when the visualizer name is only whitespace', () => {
    renderComponent({
      content: { ...content, visualizerName: ' ' },
    });

    expect(screen.queryByTitle(' ')).toBeNull();
  });

  it('surfaces the error label when the grouped send rejects', async () => {
    readyMock.mockResolvedValue(undefined);
    sendMock.mockRejectedValue(new Error('timed out'));

    renderComponent({ errorLabel: 'Failed to load visualizer' });

    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
