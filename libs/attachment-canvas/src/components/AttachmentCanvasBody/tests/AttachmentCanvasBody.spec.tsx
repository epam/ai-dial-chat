import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentCanvasContent } from '../../../models/attachment-canvas';
import {
  AttachmentContentType,
  AttachmentErrorType,
  OoxmlFileType,
} from '../../../types/attachment-canvas';
import { AttachmentCanvasBody } from '../AttachmentCanvasBody';

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

vi.mock('../../PdfContent/PdfContent', () => ({
  PdfContent: ({ url }: { url: string }) => (
    <section aria-label="pdf-content">{url}</section>
  ),
}));

vi.mock('../../OoxmlContent/OoxmlContent', () => ({
  OoxmlContent: ({ content }: { content: { format: string } }) => (
    <section aria-label="ooxml-content">{content.format}</section>
  ),
}));

const renderBody = (
  content: AttachmentCanvasContent,
  overrides: Partial<Parameters<typeof AttachmentCanvasBody>[0]> = {},
) => render(<AttachmentCanvasBody content={content} {...overrides} />);

describe('AttachmentCanvasBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner and no content while isLoading', () => {
    renderBody(
      { type: AttachmentContentType.PlainText, text: 'ignored' },
      { isLoading: true },
    );
    expect(screen.queryByText('ignored')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders PlainText content', () => {
    renderBody({
      type: AttachmentContentType.PlainText,
      text: 'Hello, world!',
    });
    expect(screen.getByText('Hello, world!')).toBeTruthy();
  });

  it('renders an image and falls back to the error state on load failure', () => {
    renderBody(
      { type: AttachmentContentType.Image, url: 'blob:image-url' },
      { fileName: 'photo.png', labels: { loadErrorLabel: 'Broken image' } },
    );
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('blob:image-url');
    fireEvent.error(img);
    expect(screen.getByText('Broken image')).toBeTruthy();
  });

  it('renders an audio element with the given mimeType', () => {
    renderBody(
      {
        type: AttachmentContentType.Audio,
        url: 'blob:audio-url',
        mimeType: 'audio/mpeg',
      },
      { fileName: 'track.mp3' },
    );
    expect(screen.getByLabelText('track.mp3')).toBeTruthy();
  });

  it('renders MarkdownRenderer for Markdown content', () => {
    renderBody({
      type: AttachmentContentType.Markdown,
      text: '# Title',
    });
    expect(
      screen.getByRole('region', { name: 'markdown-renderer' }),
    ).toBeTruthy();
  });

  it('renders JsonView for Json content', () => {
    renderBody({
      type: AttachmentContentType.Json,
      value: { key: 'value' },
    });
    expect(screen.getByRole('region', { name: 'json-viewer' })).toBeTruthy();
  });

  it('renders plain code content when no language is set', () => {
    renderBody({
      type: AttachmentContentType.Code,
      text: 'console.log(1)',
    });
    expect(screen.getByText('console.log(1)')).toBeTruthy();
  });

  it('renders HtmlContent for Html content via srcdoc', () => {
    renderBody(
      { type: AttachmentContentType.Html, srcdoc: '<p>hello</p>' },
      { fileName: 'page.html' },
    );
    expect(screen.getByTitle('page.html')).toBeTruthy();
  });

  it('renders PdfContent for Pdf content', () => {
    renderBody({
      type: AttachmentContentType.Pdf,
      url: 'blob:pdf-url',
    });
    expect(screen.getByRole('region', { name: 'pdf-content' })).toBeTruthy();
  });

  it('renders OoxmlContent for OOXML content', () => {
    renderBody({
      type: AttachmentContentType.Ooxml,
      url: 'blob:office-url',
      format: OoxmlFileType.Docx,
    });
    expect(screen.getByRole('region', { name: 'ooxml-content' })).toBeTruthy();
  });

  it('exposes the OOXML background as a host-overridable CSS variable', () => {
    const { container } = renderBody(
      {
        type: AttachmentContentType.Ooxml,
        url: 'blob:office-url',
        format: OoxmlFileType.Docx,
      },
      { styles: { colors: { ooxmlBackground: 'rebeccapurple' } } },
    );

    /* Set on the body root and inherited by OoxmlContent through the cascade. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- reading an inline CSS custom property, which has no accessible representation to query
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--ac-ooxml-bg')).toBe('rebeccapurple');
  });

  it('does not add its own scroll container for OOXML content', () => {
    const { container } = renderBody({
      type: AttachmentContentType.Ooxml,
      url: 'blob:office-url',
      format: OoxmlFileType.Docx,
    });

    /* The viewer manages its own scrolling — an outer scroll container would
     * produce nested scrollbars. */
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- asserting a CSS sizing class on the unlabeled body wrapper, which has no accessible role or text to query
    expect(container.querySelector('.overflow-hidden')).toBeTruthy();
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- same unlabeled wrapper; verifying the absence of a scroll container
    expect(container.querySelector('.overflow-auto')).toBeNull();
  });

  it('mounts the visualizer renderer for Visualizer content', () => {
    renderBody({
      type: AttachmentContentType.Visualizer,
      url: 'https://viz.example.com',
      mimeType: 'application/x-my-viz',
      data: {},
      layout: { themeId: 'light' },
      visualizerName: 'my-viz',
    });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders the unsupported-format message', () => {
    renderBody(
      { type: AttachmentContentType.Unsupported },
      { labels: { unsupportedLabel: 'Cannot preview this' } },
    );
    expect(screen.getByText('Cannot preview this')).toBeTruthy();
  });

  it('renders the LoadFailed error message', () => {
    renderBody({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.LoadFailed,
    });
    expect(screen.getByText('Failed to load file')).toBeTruthy();
  });

  it('renders the Forbidden error message', () => {
    renderBody({
      type: AttachmentContentType.Error,
      errorType: AttachmentErrorType.Forbidden,
    });
    expect(
      screen.getByText("You don't have permission to access this file"),
    ).toBeTruthy();
  });
});
