import { AttachmentType } from '@epam/ai-dial-chat-shared';
import { SkillFileNodeKind } from '@epam/ai-dial-skill-editor';
import type { SkillFileTreeNode } from '@epam/ai-dial-skill-editor';
import { describe, expect, it } from 'vitest';
import { skillFileToAttachment } from '../skill-file-preview';

const makeNode = (path: string): SkillFileTreeNode => ({
  path,
  name: path.slice(path.lastIndexOf('/') + 1),
  kind: SkillFileNodeKind.File,
});

describe('skillFileToAttachment', () => {
  it('keeps the original browser-provided MIME type when present', () => {
    const attachment = skillFileToAttachment(makeNode('report.pdf'), {
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: 'application/pdf',
    });

    expect(attachment.contentType).toBe('application/pdf');
    expect(attachment.type).toBe(AttachmentType.File);
    expect(attachment.file.type).toBe('application/pdf');
  });

  it('infers the MIME type from the path when none is provided', () => {
    const attachment = skillFileToAttachment(makeNode('agents/analyzer.md'), {
      bytes: new Uint8Array([1]),
    });

    expect(attachment.contentType).toBe('text/markdown');
  });

  it('classifies an inferred image MIME type as Image', () => {
    const attachment = skillFileToAttachment(makeNode('assets/logo.png'), {
      bytes: new Uint8Array([1]),
    });

    expect(attachment.type).toBe(AttachmentType.Image);
  });

  it('produces distinct ids for files sharing a basename in different folders', () => {
    const a = skillFileToAttachment(makeNode('agents/README.md'), {
      bytes: new Uint8Array([1]),
    });
    const b = skillFileToAttachment(makeNode('assets/README.md'), {
      bytes: new Uint8Array([1]),
    });

    expect(a.id).toBe('agents/README.md');
    expect(b.id).toBe('assets/README.md');
    expect(a.id).not.toBe(b.id);
  });

  it('produces a valid zero-byte file for empty content', () => {
    const attachment = skillFileToAttachment(makeNode('empty.txt'), {
      bytes: new Uint8Array(0),
    });

    expect(attachment.file.size).toBe(0);
    expect(attachment.contentType).toBe('text/plain');
  });
});
