import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HTML_PREVIEW_FRAME_RENDER_MESSAGE } from '../../../constants/html-preview';
import type { HtmlCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { HtmlContent } from '../HtmlContent';

const url = 'https://example.com/docs/page.html';

const renderContent = (content: HtmlCanvasContent, isSourceView = false) =>
  render(
    <HtmlContent
      content={content}
      labels={{}}
      isSourceView={isSourceView}
      title="page.html"
    />,
  );

/** Simulates a cross-origin page whose document the host cannot reach. */
const loadBlockedIframe = () => {
  const iframe = screen.getByTitle('page.html');
  Object.defineProperty(iframe, 'contentDocument', {
    configurable: true,
    get: () => {
      throw new Error('cross-origin');
    },
  });
  fireEvent.load(iframe);
};

describe('HtmlContent — blocked state', () => {
  it('offers the fallback as a link to the page, not a button', () => {
    renderContent({ type: AttachmentContentType.Html, url });
    loadBlockedIframe();

    const link = screen.getByRole('link', { name: 'Open in new tab' });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the frame-blocked message', () => {
    renderContent({ type: AttachmentContentType.Html, url });
    loadBlockedIframe();

    expect(
      screen.getByText('This page cannot be displayed in preview'),
    ).toBeTruthy();
  });

  it('keeps rendering srcdoc content, which is never block-detected', () => {
    renderContent({
      type: AttachmentContentType.Html,
      srcdoc: '<p>Hi</p>',
    });
    loadBlockedIframe();

    expect(screen.getByTitle('page.html')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('HtmlContent — src/srcdoc precedence and sandbox', () => {
  it('renders local srcdoc-only content via srcdoc with no allow-same-origin', () => {
    renderContent({
      type: AttachmentContentType.Html,
      srcdoc: '<p>Hi</p>',
    });

    const iframe = screen.getByTitle('page.html');
    expect(iframe.getAttribute('srcdoc')).toBe('<p>Hi</p>');
    expect(iframe.getAttribute('src')).toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('renders a same-origin download URL via src even when srcdoc is also present, with no allow-same-origin', () => {
    renderContent({
      type: AttachmentContentType.Html,
      url,
      isSameOriginUrl: true,
      srcdoc: '<p>Hi</p>',
    });

    const iframe = screen.getByTitle('page.html');
    expect(iframe.getAttribute('src')).toBe(url);
    expect(iframe.getAttribute('srcdoc')).toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('renders an external URL via src with allow-same-origin', () => {
    renderContent({ type: AttachmentContentType.Html, url });

    const iframe = screen.getByTitle('page.html');
    expect(iframe.getAttribute('src')).toBe(url);
    expect(iframe.getAttribute('srcdoc')).toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin',
    );
  });

  it('skips block-detection for a same-origin download URL', () => {
    renderContent({
      type: AttachmentContentType.Html,
      url,
      isSameOriginUrl: true,
    });
    loadBlockedIframe();

    expect(screen.getByTitle('page.html')).toBeTruthy();
    expect(
      screen.queryByText('This page cannot be displayed in preview'),
    ).toBeNull();
  });
});

describe('HtmlContent — srcdoc through a host document', () => {
  const hostUrl = '/api/v1/files/html-preview-frame';
  const html = '<style>p{color:red}</style><p>Hi</p>';

  const stubContentWindow = (iframe: HTMLElement) => {
    const postMessage = vi.fn();
    const frameWindow = { postMessage };
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get: () => frameWindow,
    });
    return postMessage;
  };

  it('loads the host document via src instead of srcdoc, with no allow-same-origin', () => {
    renderContent({
      type: AttachmentContentType.Html,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    });

    const iframe = screen.getByTitle('page.html');
    expect(iframe.getAttribute('src')).toBe(hostUrl);
    expect(iframe.getAttribute('srcdoc')).toBeNull();
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('posts the HTML to the host document once, even if it fires load again', () => {
    renderContent({
      type: AttachmentContentType.Html,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    });
    const iframe = screen.getByTitle('page.html');
    const postMessage = stubContentWindow(iframe);

    fireEvent.load(iframe);
    fireEvent.load(iframe);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      { type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html },
      '*',
    );
  });

  it('never block-detects the opaque-origin host document', () => {
    renderContent({
      type: AttachmentContentType.Html,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    });
    loadBlockedIframe();

    expect(screen.getByTitle('page.html')).toBeTruthy();
    expect(
      screen.queryByText('This page cannot be displayed in preview'),
    ).toBeNull();
  });

  it('remounts the frame and posts the new HTML when the content changes', () => {
    const { rerender } = renderContent({
      type: AttachmentContentType.Html,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    });
    const firstIframe = screen.getByTitle('page.html');
    stubContentWindow(firstIframe);
    fireEvent.load(firstIframe);

    const nextHtml = '<p>Next</p>';
    rerender(
      <HtmlContent
        content={{
          type: AttachmentContentType.Html,
          srcdoc: nextHtml,
          srcdocHostUrl: hostUrl,
        }}
        labels={{}}
        isSourceView={false}
        title="page.html"
      />,
    );
    const nextIframe = screen.getByTitle('page.html');
    expect(nextIframe).not.toBe(firstIframe);
    const postMessage = stubContentWindow(nextIframe);
    fireEvent.load(nextIframe);

    expect(postMessage).toHaveBeenCalledWith(
      { type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html: nextHtml },
      '*',
    );
  });

  it('posts the HTML again to the frame remounted after a View source round-trip', () => {
    const content: HtmlCanvasContent = {
      type: AttachmentContentType.Html,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    };
    const renderWithView = (isSourceView: boolean) => (
      <HtmlContent
        content={content}
        labels={{}}
        isSourceView={isSourceView}
        title="page.html"
      />
    );
    const { rerender } = render(renderWithView(false));
    const firstIframe = screen.getByTitle('page.html');
    stubContentWindow(firstIframe);
    fireEvent.load(firstIframe);

    rerender(renderWithView(true));
    expect(screen.queryByTitle('page.html')).toBeNull();

    rerender(renderWithView(false));
    const nextIframe = screen.getByTitle('page.html');
    expect(nextIframe).not.toBe(firstIframe);
    expect(nextIframe.className).toContain('invisible');
    const postMessage = stubContentWindow(nextIframe);
    fireEvent.load(nextIframe);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      { type: HTML_PREVIEW_FRAME_RENDER_MESSAGE, html },
      '*',
    );
    expect(nextIframe.className).not.toContain('invisible');
  });

  it('ignores the host document when a same-origin download URL takes precedence', () => {
    renderContent({
      type: AttachmentContentType.Html,
      url,
      isSameOriginUrl: true,
      srcdoc: html,
      srcdocHostUrl: hostUrl,
    });

    expect(screen.getByTitle('page.html').getAttribute('src')).toBe(url);
  });
});

describe('HtmlContent — View source with a lazy resolver', () => {
  it('does not call resolveSourceText while the source view is not shown', () => {
    const resolveSourceText = vi.fn().mockResolvedValue('<p>Source</p>');
    renderContent({
      type: AttachmentContentType.Html,
      url,
      isSameOriginUrl: true,
      resolveSourceText,
    });

    expect(resolveSourceText).not.toHaveBeenCalled();
  });

  it('fetches the source text lazily and renders it once the view toggles on', async () => {
    const resolveSourceText = vi.fn().mockResolvedValue('<p>Source</p>');
    renderContent(
      {
        type: AttachmentContentType.Html,
        url,
        isSameOriginUrl: true,
        resolveSourceText,
      },
      true,
    );

    expect(resolveSourceText).toHaveBeenCalledOnce();
    expect(await screen.findByText('<p>Source</p>')).toBeTruthy();
  });

  it('shows no iframe while the lazy fetch is in flight', async () => {
    let resolveFetch: (text: string) => void = () => undefined;
    const resolveSourceText = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    renderContent(
      {
        type: AttachmentContentType.Html,
        url,
        isSameOriginUrl: true,
        resolveSourceText,
      },
      true,
    );

    expect(screen.queryByTitle('page.html')).toBeNull();

    resolveFetch('<p>Source</p>');
    expect(await screen.findByText('<p>Source</p>')).toBeTruthy();
  });

  it('falls back to the iframe when the lazy fetch fails', async () => {
    const resolveSourceText = vi.fn().mockRejectedValue(new Error('network'));
    renderContent(
      {
        type: AttachmentContentType.Html,
        url,
        isSameOriginUrl: true,
        resolveSourceText,
      },
      true,
    );

    expect(await screen.findByTitle('page.html')).toBeTruthy();
  });
});
