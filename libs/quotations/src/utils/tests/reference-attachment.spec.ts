import type { MessageAttachment } from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getReferenceAttachmentGroups,
  isReferenceOnlyAttachment,
  parsePdfPageReference,
} from '../reference-attachment';

const makeAttachment = (
  overrides: Partial<MessageAttachment> = {},
): MessageAttachment => ({
  title: 'livescience.com',
  ...overrides,
});

describe('isReferenceOnlyAttachment', () => {
  it('returns false when both url and reference_url are set', () => {
    const dto = makeAttachment({
      url: 'files/bucket/report.pdf',
      reference_url: 'https://example.com/report',
    });
    expect(isReferenceOnlyAttachment(dto)).toBe(false);
  });

  it('returns true when only reference_url is set', () => {
    const dto = makeAttachment({ reference_url: 'https://example.com/a' });
    expect(isReferenceOnlyAttachment(dto)).toBe(true);
  });

  it('returns false when neither url nor reference_url is set', () => {
    expect(isReferenceOnlyAttachment(makeAttachment())).toBe(false);
  });
});

describe('getReferenceAttachmentGroups', () => {
  it('returns an empty array for undefined input', () => {
    expect(getReferenceAttachmentGroups(undefined)).toEqual([]);
  });

  it('returns an empty array when all attachments have a url', () => {
    const dtos = [makeAttachment({ url: 'files/bucket/a.pdf' })];
    expect(getReferenceAttachmentGroups(dtos)).toEqual([]);
  });

  it('groups repeated chunks sharing the same reference_url into one group', () => {
    const referenceUrl = 'https://vertexaisearch.example.com/redirect/abc';
    const dtos: MessageAttachment[] = [
      makeAttachment({
        title: 'livescience.com',
        data: 'Dinosaurs first appeared in the Triassic',
        reference_url: referenceUrl,
        reference_type: 'text/markdown',
      }),
      makeAttachment({
        title: 'livescience.com',
        data: 'Extinction was 66 million years ago',
        reference_url: referenceUrl,
        reference_type: 'text/markdown',
      }),
      makeAttachment({
        title: 'wikipedia.org',
        data: 'Birds are dinosaurs',
        reference_url: 'https://vertexaisearch.example.com/redirect/def',
        reference_type: 'text/markdown',
      }),
    ];

    const groups = getReferenceAttachmentGroups(dtos);

    expect(groups).toHaveLength(2);
    const liveScienceGroup = groups.find((g) => g.sourceUrl === referenceUrl);
    expect(liveScienceGroup?.annotations).toHaveLength(2);
    expect(liveScienceGroup?.sourceName).toBe('livescience.com');
    expect(liveScienceGroup?.annotations[0].body?.quote).toBe(
      'Dinosaurs first appeared in the Triassic',
    );
  });

  it('sets the attachment type to application/pdf for a PDF reference with a page anchor', () => {
    const dtos: MessageAttachment[] = [
      makeAttachment({
        title: '[0.2818] uploads/2026-07/report.pdf',
        type: 'text/markdown',
        data: 'ejKc :',
        reference_url: 'files/bucket/uploads/2026-07/report.pdf#page=81',
      }),
    ];

    const groups = getReferenceAttachmentGroups(dtos);

    expect(groups[0].primaryAnnotation.body?.source?.attachment.type).toBe(
      MIMEType.PDF,
    );
  });
});

describe('parsePdfPageReference', () => {
  it('parses a PDF url with a page anchor', () => {
    expect(
      parsePdfPageReference('files/bucket/uploads/report%20(3).pdf#page=81'),
    ).toEqual({
      baseUrl: 'files/bucket/uploads/report%20(3).pdf',
      page: 81,
    });
  });

  it('parses a PDF url with no page anchor', () => {
    expect(parsePdfPageReference('files/bucket/report.pdf')).toEqual({
      baseUrl: 'files/bucket/report.pdf',
      page: null,
    });
  });

  it('returns null for a non-PDF url', () => {
    expect(
      parsePdfPageReference('https://example.com/redirect/abc'),
    ).toBeNull();
  });
});
