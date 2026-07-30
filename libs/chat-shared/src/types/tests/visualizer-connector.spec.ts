import { describe, expect, it } from 'vitest';
import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
  visualizerConnectorLibName,
} from '../../constants/visualizer-connector';
import type {
  AttachmentData,
  AttachmentItem,
  CustomVisualizer,
  CustomVisualizerData,
  CustomVisualizerDataLayout,
  GroupedAttachmentsData,
  VisualizerConnectorOptions,
  VisualizerConnectorRequest,
} from '../visualizer-connector';

describe('visualizer-connector constants', () => {
  it('exposes event members with correct wire values', () => {
    expect(VisualizerConnectorEvents.Ready).toBe('READY');
    expect(VisualizerConnectorEvents.ReadyToInteract).toBe('READY_TO_INTERACT');
    expect(VisualizerConnectorEvents.SendMessage).toBe('SEND_MESSAGE');
    expect(Object.values(VisualizerConnectorEvents)).toHaveLength(3);
  });

  it('exposes request members with correct wire values', () => {
    expect(VisualizerConnectorRequests.SendVisualizeData).toBe(
      'SEND_VISUALIZE_DATA',
    );
    expect(VisualizerConnectorRequests.SendGroupedVisualizeData).toBe(
      'SEND_GROUPED_VISUALIZE_DATA',
    );
    expect(Object.values(VisualizerConnectorRequests)).toHaveLength(2);
  });

  it('keeps the debug lib name separate from any wire-format enum', () => {
    expect(visualizerConnectorLibName).toBe('VisualizerConnector');
  });
});

describe('visualizer-connector type shapes', () => {
  it('compiles a full CustomVisualizer entry (all fields matching development schema)', () => {
    const entry: CustomVisualizer = {
      title: 'my-viz',
      description: 'A custom visualizer',
      icon: 'https://viz.example.com/icon.svg',
      contentType: 'application/x-my-viz, application/x-my-viz-2',
      url: 'https://viz.example.com',
      requestTimeout: 15000,
      passAuthInfo: false,
      passExplicitToken: false,
    };
    expect(entry.title).toBe('my-viz');
  });

  it('compiles a minimal CustomVisualizer entry (only required fields)', () => {
    const entry: CustomVisualizer = {
      title: 'my-viz',
      contentType: 'application/x-my-viz',
      url: 'https://viz.example.com',
    };
    expect(entry.requestTimeout).toBeUndefined();
  });

  it('compiles a CustomVisualizerDataLayout with only themeId', () => {
    const layout: CustomVisualizerDataLayout = {
      themeId: 'dark',
    };
    expect(layout.themeId).toBe('dark');
  });

  it('compiles CustomVisualizerData with an opaque payload alongside layout', () => {
    const data: CustomVisualizerData = {
      layout: { themeId: 'dark' },
      series: [1, 2, 3],
    };
    expect(data['series']).toEqual([1, 2, 3]);
  });

  it('compiles a full AttachmentData request payload', () => {
    const payload: AttachmentData = {
      mimeType: 'application/x-my-viz',
      visualizerData: {
        layout: { themeId: 'dark' },
        rows: [],
      },
    };
    expect(payload.mimeType).toBe('application/x-my-viz');
  });

  it('compiles VisualizerConnectorOptions with all optional fields', () => {
    const options: VisualizerConnectorOptions = {
      domain: 'https://viz.example.com',
      visualizerName: 'my-viz',
      requestTimeout: 10000,
      loaderStyles: { position: 'absolute' },
      loaderClass: 'loader',
      loaderInnerHTML: '<span>Loading</span>',
    };
    expect(options.visualizerName).toBe('my-viz');
  });

  it('compiles a VisualizerConnectorRequest envelope with and without a requestId', () => {
    const event: VisualizerConnectorRequest = { type: 'my-viz/READY' };
    const request: VisualizerConnectorRequest = {
      type: 'my-viz/SEND_VISUALIZE_DATA',
      requestId: 'abc-123',
      payload: { mimeType: 'application/x-my-viz' },
    };
    expect(event.requestId).toBeUndefined();
    expect(request.requestId).toBe('abc-123');
  });

  it('compiles a full GroupedAttachmentsData payload', () => {
    const item: AttachmentItem = {
      url: 'https://example.com/chart.json',
      mimeType: 'application/vnd.plotly.v1+json',
      visualizerData: { layout: { themeId: 'dark' } },
    };
    const grouped: GroupedAttachmentsData = {
      attachments: [item],
      layout: { themeId: 'dark' },
    };
    expect(grouped.attachments).toHaveLength(1);
    expect(grouped.layout.themeId).toBe('dark');
  });
});
