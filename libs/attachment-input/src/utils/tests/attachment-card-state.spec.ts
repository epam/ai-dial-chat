import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { getAttachmentCardState } from '../attachment';

const makeAttachment = (
  overrides: Partial<DisplayAttachment>,
): DisplayAttachment => ({
  id: 'test-id',
  name: 'file',
  contentType: '',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  ...overrides,
});

describe('getAttachmentCardState – typeLabel', () => {
  it('returns .md for text/markdown contentType with a sentence-ending name', () => {
    const attachment = makeAttachment({
      name: '[1] RAG search: List the three main topics covered in the PDF document.',
      contentType: 'text/markdown',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('.md');
  });

  it('returns .md for text/markdown contentType even when name contains .pdf', () => {
    const attachment = makeAttachment({
      name: '[1] uploads/2026-03/test_FinancialReport.pdf',
      contentType: 'text/markdown',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('.md');
  });

  it('returns .txt for text/plain contentType', () => {
    const attachment = makeAttachment({
      name: 'notes',
      contentType: 'text/plain',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('.txt');
  });

  it('returns .pdf for application/pdf contentType', () => {
    const attachment = makeAttachment({
      name: 'report.pdf',
      contentType: 'application/pdf',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('.pdf');
  });

  it('falls back to name extension for vendor MIME types', () => {
    const attachment = makeAttachment({
      name: 'document.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('.docx');
  });

  it('does not produce a bare dot when name ends with a period and no contentType', () => {
    const attachment = makeAttachment({
      name: 'Some sentence ending.',
      contentType: '',
    });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).not.toBe('.');
  });

  it('returns Prompt for Prompt type', () => {
    const attachment = makeAttachment({ type: AttachmentType.Prompt });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('Prompt');
  });

  it('returns Pasted for Pasted type', () => {
    const attachment = makeAttachment({ type: AttachmentType.Pasted });
    const { typeLabel } = getAttachmentCardState(attachment, false, false);
    expect(typeLabel).toBe('Pasted');
  });
});
