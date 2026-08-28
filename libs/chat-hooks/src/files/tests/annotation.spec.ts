import type { AttachmentResource } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openAnnotationAttachment } from '../annotation';

describe('openAnnotationAttachment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when the attachment has no url', () => {
    const resolveDownloadUrl = vi.fn();
    openAnnotationAttachment({} as AttachmentResource, resolveDownloadUrl);
    expect(resolveDownloadUrl).not.toHaveBeenCalled();
  });

  it('triggers a download for a DIAL file reference via the injected resolver', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const anchor = document.createElement('a');
    const anchorClick = vi.fn();
    anchor.click = anchorClick;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    const resolveDownloadUrl = vi.fn(() => '/api/v1/files/download?x=y');
    openAnnotationAttachment(
      {
        type: 'application/pdf',
        url: 'files/bucket/report.pdf',
        title: 'Report',
      },
      resolveDownloadUrl,
    );

    expect(resolveDownloadUrl).toHaveBeenCalledWith('files/bucket/report.pdf');
    expect(anchorClick).toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens a non-DIAL URL in a new tab without calling the resolver', () => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
    const resolveDownloadUrl = vi.fn();

    openAnnotationAttachment(
      { type: 'application/pdf', url: 'https://example.com/doc.pdf' },
      resolveDownloadUrl,
    );

    expect(resolveDownloadUrl).not.toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith(
      'https://example.com/doc.pdf',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
