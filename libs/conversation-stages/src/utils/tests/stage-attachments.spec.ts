import { describe, expect, it } from 'vitest';
import { mapStageAttachmentsToDisplay } from '../stage-attachments';

describe('mapStageAttachmentsToDisplay', () => {
  it("prefers the attachment's own declared type over the type inferred from reference_url", () => {
    const [attachment] = mapStageAttachmentsToDisplay([
      {
        title: '[0.202] uploads/2026-09/glossary_terms.csv',
        type: 'text/markdown',
        data: 'Some markdown text',
        reference_url: 'files/abc/uploads/2026-09/glossary_terms.csv',
      },
    ]);

    expect(attachment.contentType).toBe('text/markdown');
  });

  it('falls back to the inferred type when the attachment declares no type', () => {
    const [attachment] = mapStageAttachmentsToDisplay([
      {
        title: 'result.csv',
        reference_url: 'files/abc/result.csv',
      },
    ]);

    expect(attachment.contentType).toBe('text/csv');
  });

  it('maps each attachment to the correct declared type when several are present', () => {
    const attachments = mapStageAttachmentsToDisplay([
      {
        title: 'First',
        type: 'text/markdown',
        data: 'first body',
        reference_url: 'files/abc/first.csv',
      },
      {
        title: 'Second',
        type: 'text/plain',
        data: 'second body',
        reference_url: 'files/abc/second.pdf',
      },
    ]);

    expect(attachments.map((a) => a.contentType)).toEqual([
      'text/markdown',
      'text/plain',
    ]);
  });

  it('resolves an image preview URL through the host-supplied resolver', () => {
    const url = 'files/bucket/appdata/app/render_pages-2026-10-21T12-15-11.png';
    const [attachment] = mapStageAttachmentsToDisplay(
      [{ title: 'render.png', type: 'image/png', url }],
      { resolvePreviewUrl: (dto) => `/download?path=${dto.url}` },
    );

    expect(attachment.previewUrl).toBe(`/download?path=${url}`);
    expect(attachment.url).toBe(url);
  });

  it('falls back to the raw url as the image preview when no resolver is supplied', () => {
    const [attachment] = mapStageAttachmentsToDisplay([
      {
        title: 'render.png',
        type: 'image/png',
        url: 'files/bucket/render.png',
      },
    ]);

    expect(attachment.previewUrl).toBe('files/bucket/render.png');
  });

  it('returns an empty array when there are no attachments', () => {
    expect(mapStageAttachmentsToDisplay(undefined)).toEqual([]);
    expect(mapStageAttachmentsToDisplay([])).toEqual([]);
  });

  it("keeps the surviving (first-occurrence) attachment's own type when a later duplicate id declares a different type", () => {
    const attachments = mapStageAttachmentsToDisplay([
      {
        title: 'same-title',
        type: 'text/markdown',
        reference_url: 'files/abc/a.csv',
      },
      {
        title: 'same-title',
        type: 'text/plain',
        reference_url: 'files/abc/b.csv',
      },
    ]);

    expect(attachments).toHaveLength(1);
    expect(attachments[0].contentType).toBe('text/markdown');
  });
});
