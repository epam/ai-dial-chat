import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@testing-library/react';

import { MessageAttachment } from '@/src/components/Chat/MessageAttachment';

import { Attachment } from '@epam/ai-dial-shared';

// Mock VisualizerRenderer
vi.mock('@/src/components/VisualalizerRenderer/VisualizerRenderer', () => ({
  VisualizerRenderer: () => (
    <div data-qa="visualizer-renderer">Visualizer Content</div>
  ),
}));

// Mock SVG icons
vi.mock('@/public/images/icons/arrow-up-right-from-square.svg', () => ({
  default: () => <svg data-qa="link-icon" />,
}));
vi.mock('@/public/images/icons/chevron-down.svg', () => ({
  default: () => <svg data-qa="chevron-down" />,
}));

// Mock Redux hooks
const mockDispatch = vi.fn();
vi.mock('@/src/store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAppSelector: (selector: any) => {
    // Check if selector is a function, otherwise treat it as a mock return value or handle appropriately
    if (typeof selector === 'function') {
      return selector({});
    }
    // If it's the memoized selector which might return the function or value directly depending on how it's mocked
    return selector;
  },
}));

// Mock Selectors
vi.mock('@/src/store/selectors', () => ({
  ConversationsSelectors: {
    selectLoadedCharts: () => [],
    selectChartLoading: () => false,
  },
  SettingsSelectors: {
    selectMappedVisualizers: () => ({
      'application/vnd.custom': [
        { title: 'Custom Visualizer', url: 'http://localhost:3000' },
      ],
    }),
    selectIsCustomAttachmentType: () => () => true, // Return a function that returns true
    selectAttachmentsSettings: () => ({
      expandedTypes: [],
      borderlessTypes: [],
      withoutTitleTypes: [],
    }),
  },
}));

// Mock Translation
vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock Attachments Utils
vi.mock('@/src/utils/app/attachments', () => ({
  getMappedAttachmentUrl: (url: string) => url,
  hasPdfExtension: () => false,
}));

// Mock Plotly Components
vi.mock('@/src/components/Plotly/Plotly', () => ({
  PlotlyComponent: () => <div data-qa="plotly-component">Plotly Content</div>,
}));
vi.mock('@/src/components/Plotly/PlotlyStringDataRenderer', () => ({
  PlotlyStringDataRenderer: () => (
    <div data-qa="plotly-string-renderer">Plotly String Content</div>
  ),
}));

// Mock ErrorBoundary
vi.mock('@/src/components/Common/ErrorBoundary', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  withErrorBoundary: (Component: any) => Component,
}));

describe('MessageAttachment', () => {
  const customType = 'application/vnd.custom';

  it('Scenario A: Renders Custom Visualizer when URL is present', () => {
    const attachment: Attachment = {
      title: 'test attachment',
      type: customType,
      url: 'http://example.com/data.json',
    };

    render(<MessageAttachment attachment={attachment} />);

    // Click to expand
    const button = screen.getByText('test attachment');
    fireEvent.click(button);

    // Should render VisualizerRenderer
    expect(screen.getByTestId('visualizer-renderer')).toBeInTheDocument();
  });

  it('Scenario B: Renders Custom Visualizer when data is present but URL is missing (Inline data)', () => {
    const attachment: Attachment = {
      title: 'inline attachment',
      type: customType,
      data: 'eyJoZWxsbyI6IndvcmxkIn0=', // base64 for {"hello":"world"}
    };

    render(<MessageAttachment attachment={attachment} />);

    // Click to expand
    const button = screen.getByText('inline attachment');
    fireEvent.click(button);

    // Should render VisualizerRenderer
    expect(screen.getByTestId('visualizer-renderer')).toBeInTheDocument();
  });

  it('Scenario C: Renders nothing specific if both URL and data are missing', () => {
    const attachment: Attachment = {
      title: 'empty attachment',
      type: customType,
    };

    render(<MessageAttachment attachment={attachment} />);

    // Click to expand
    const button = screen.getByText('empty attachment');
    fireEvent.click(button);

    // Should NOT render VisualizerRenderer
    expect(screen.queryByTestId('visualizer-renderer')).not.toBeInTheDocument();
  });
});
