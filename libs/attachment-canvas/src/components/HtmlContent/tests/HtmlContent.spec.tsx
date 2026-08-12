import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HtmlCanvasContent } from '../../../models/attachment-canvas';
import { AttachmentContentType } from '../../../types/attachment-canvas';
import { HtmlContent } from '../HtmlContent';

const url = 'https://example.com/docs/page.html';

const renderContent = (content: HtmlCanvasContent) =>
  render(
    <HtmlContent
      content={content}
      labels={{}}
      isSourceView={false}
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
