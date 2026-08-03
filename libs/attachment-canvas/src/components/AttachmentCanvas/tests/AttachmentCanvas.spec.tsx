import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AttachmentCanvasContent } from '../../../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
} from '../../../types/attachment-canvas';
import { AttachmentCanvas } from '../AttachmentCanvas';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MarkdownRenderer: ({ content }: { content: string }) => (
      <section aria-label="markdown-renderer">{content}</section>
    ),
  };
});

vi.mock('react-json-view-lite', () => ({
  JsonView: ({ data }: { data: object }) => (
    <section aria-label="json-viewer">{JSON.stringify(data)}</section>
  ),
  defaultStyles: {},
}));

vi.mock('@epam/ai-dial-visualizer-connector', () => ({
  VisualizerConnector: vi.fn().mockImplementation(function () {
    return {
      ready: vi.fn().mockReturnValue(new Promise(() => undefined)),
      send: vi.fn(),
      destroy: vi.fn(),
    };
  }),
}));

const plainTextContent: AttachmentCanvasContent = {
  type: AttachmentContentType.PlainText,
  text: 'Hello, world!\nSecond line.',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  content: plainTextContent,
  fileName: 'notes.txt',
  labels: { ariaLabel: 'Attachment canvas' },
};

describe('AttachmentCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel region when isOpen is true', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(
      screen.getByRole('complementary', { name: 'Attachment canvas' }),
    ).toBeDefined();
  });

  it('hides the panel when isOpen is false', () => {
    render(<AttachmentCanvas {...defaultProps} isOpen={false} />);
    const panel = screen.getByRole('complementary', { hidden: true });
    expect(panel.getAttribute('aria-hidden')).toBeNull();
  });

  it('shows the file name as the panel title', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.getByText('notes.txt')).toBeDefined();
  });

  it('renders plain text content', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.getByText(/Hello, world!/)).toBeDefined();
  });

  it('calls onClose when the close button is clicked', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render a download button when onDownload is not provided', () => {
    render(<AttachmentCanvas {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('renders a download button when onDownload is provided', () => {
    const onDownload = vi.fn();
    render(<AttachmentCanvas {...defaultProps} onDownload={onDownload} />);
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('calls onDownload when the download button is clicked', () => {
    const onDownload = vi.fn();
    render(<AttachmentCanvas {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('uses a custom downloadLabel for the download button aria-label', () => {
    render(
      <AttachmentCanvas
        {...defaultProps}
        onDownload={vi.fn()}
        labels={{ ...defaultProps.labels, downloadLabel: 'Save file' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save file' })).toBeDefined();
  });

  it('uses a custom closeLabel for the close button aria-label', () => {
    render(
      <AttachmentCanvas
        {...defaultProps}
        labels={{ ...defaultProps.labels, closeLabel: 'Dismiss' }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });

  it('renders MarkdownRenderer for Markdown content', () => {
    const markdownContent: AttachmentCanvasContent = {
      type: AttachmentContentType.Markdown,
      text: '# Hello\n\nThis is **markdown**.',
    };
    render(<AttachmentCanvas {...defaultProps} content={markdownContent} />);
    expect(
      screen.getByRole('region', { name: 'markdown-renderer' }),
    ).toBeDefined();
  });

  it('renders JsonView for Json content', () => {
    const jsonContent: AttachmentCanvasContent = {
      type: AttachmentContentType.Json,
      value: { key: 'value', count: 42 },
    };
    render(<AttachmentCanvas {...defaultProps} content={jsonContent} />);
    expect(screen.getByRole('region', { name: 'json-viewer' })).toBeDefined();
  });

  it('renders the Json container with dir="ltr"', () => {
    const jsonContent: AttachmentCanvasContent = {
      type: AttachmentContentType.Json,
      value: { nested: true },
    };
    const { container } = render(
      <AttachmentCanvas {...defaultProps} content={jsonContent} />,
    );
    expect(container.querySelector('[dir="ltr"]')).toBeTruthy();
  });

  describe('Error content', () => {
    it('renders the default load-error message for a LoadFailed error', () => {
      const errorContent: AttachmentCanvasContent = {
        type: AttachmentContentType.Error,
        errorType: AttachmentErrorType.LoadFailed,
        url: 'https://example.com/doc.pdf',
      };
      render(<AttachmentCanvas {...defaultProps} content={errorContent} />);
      expect(screen.getByText('Failed to load file')).toBeDefined();
    });

    it('renders the default forbidden message for a Forbidden error', () => {
      const errorContent: AttachmentCanvasContent = {
        type: AttachmentContentType.Error,
        errorType: AttachmentErrorType.Forbidden,
        url: 'https://example.com/doc.pdf',
      };
      render(<AttachmentCanvas {...defaultProps} content={errorContent} />);
      expect(
        screen.getByText("You don't have permission to access this file"),
      ).toBeDefined();
    });

    it('renders custom loadErrorLabel and forbiddenErrorLabel', () => {
      const errorContent: AttachmentCanvasContent = {
        type: AttachmentContentType.Error,
        errorType: AttachmentErrorType.Forbidden,
      };
      render(
        <AttachmentCanvas
          {...defaultProps}
          content={errorContent}
          labels={{ ...defaultProps.labels, forbiddenErrorLabel: 'No access' }}
        />,
      );
      expect(screen.getByText('No access')).toBeDefined();
    });

    it('shows the download button for a LoadFailed error with a url', () => {
      const errorContent: AttachmentCanvasContent = {
        type: AttachmentContentType.Error,
        errorType: AttachmentErrorType.LoadFailed,
        url: 'https://example.com/doc.pdf',
      };
      render(
        <AttachmentCanvas
          {...defaultProps}
          content={errorContent}
          onDownload={vi.fn()}
        />,
      );
      expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
    });

    it('hides the download button for a Forbidden error even when a url is present', () => {
      const errorContent: AttachmentCanvasContent = {
        type: AttachmentContentType.Error,
        errorType: AttachmentErrorType.Forbidden,
        url: 'https://example.com/doc.pdf',
      };
      render(
        <AttachmentCanvas
          {...defaultProps}
          content={errorContent}
          onDownload={vi.fn()}
        />,
      );
      expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    });
  });

  describe('Visualizer content', () => {
    const visualizerContent: AttachmentCanvasContent = {
      type: AttachmentContentType.Visualizer,
      url: 'https://viz.example.com',
      mimeType: 'application/x-my-viz',
      data: { series: [1, 2, 3] },
      layout: { themeId: 'dark' },
      visualizerName: 'my-viz',
    };

    it('mounts the visualizer renderer inside the panel body', () => {
      render(
        <AttachmentCanvas {...defaultProps} content={visualizerContent} />,
      );
      expect(screen.getByRole('status')).toBeDefined();
    });

    it('still renders the fileName as the panel title', () => {
      render(
        <AttachmentCanvas {...defaultProps} content={visualizerContent} />,
      );
      expect(screen.getByText('notes.txt')).toBeDefined();
    });

    it('does not render a download button even when onDownload is provided', () => {
      render(
        <AttachmentCanvas
          {...defaultProps}
          content={visualizerContent}
          onDownload={vi.fn()}
        />,
      );
      expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    });
  });
});
