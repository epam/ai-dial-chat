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
  it.each([
    [
      'returns .md for text/markdown contentType with a sentence-ending name',
      {
        name: '[1] RAG search: List the three main topics covered in the PDF document.',
        contentType: 'text/markdown',
        expected: '.md',
      },
    ],
    [
      'returns .md for text/markdown contentType even when name contains .pdf',
      {
        name: '[1] uploads/2026-03/test_FinancialReport.pdf',
        contentType: 'text/markdown',
        expected: '.md',
      },
    ],
    [
      'returns .txt for text/plain contentType',
      { name: 'notes', contentType: 'text/plain', expected: '.txt' },
    ],
    [
      'returns .pdf for application/pdf contentType',
      { name: 'report.pdf', contentType: 'application/pdf', expected: '.pdf' },
    ],
    [
      'falls back to name extension for vendor MIME types',
      {
        name: 'document.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        expected: '.docx',
      },
    ],
  ])('%s', (_name, { name, contentType, expected }) => {
    const attachment = makeAttachment({ name, contentType });
    const { typeLabel } = getAttachmentCardState(attachment);
    expect(typeLabel).toBe(expected);
  });

  it('does not produce a bare dot when name ends with a period and no contentType', () => {
    const attachment = makeAttachment({
      name: 'Some sentence ending.',
      contentType: '',
    });
    const { typeLabel } = getAttachmentCardState(attachment);
    expect(typeLabel).not.toBe('.');
  });

  it('returns Prompt for Prompt type', () => {
    const attachment = makeAttachment({ type: AttachmentType.Prompt });
    const { typeLabel } = getAttachmentCardState(attachment);
    expect(typeLabel).toBe('Prompt');
  });

  it('returns Pasted for Pasted type', () => {
    const attachment = makeAttachment({ type: AttachmentType.Pasted });
    const { typeLabel } = getAttachmentCardState(attachment);
    expect(typeLabel).toBe('Pasted');
  });
});
