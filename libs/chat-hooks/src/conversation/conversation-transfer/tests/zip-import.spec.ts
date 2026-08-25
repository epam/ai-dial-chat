import type { Conversation, ExportFormat } from '@epam/ai-dial-chat-shared';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { UnsupportedImportFormatError } from '../import-conversation';
import { parseDialArchive } from '../zip-import';

const makeConversation = (): Conversation => ({
  id: 'bucket-a/gpt-4o__My Chat',
  folderId: 'bucket-a',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 0.5,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
});

/** Both new-chat and old-chat archives write the same envelope version. */
const envelope: ExportFormat = {
  version: 5,
  history: [makeConversation()],
  folders: [],
};

const zipToFile = (
  files: Record<string, Uint8Array>,
  name = 'export.dial',
): File => {
  const zipped = zipSync(files);
  return new File([new Uint8Array(zipped)], name, {
    type: 'application/zip',
  });
};

describe('parseDialArchive', () => {
  it('reads the envelope and attachments from a new-chat archive', async () => {
    const file = zipToFile({
      'conversation.json': strToU8(JSON.stringify(envelope)),
      'res/reports/q1.pdf': strToU8('pdf-bytes'),
    });

    const result = await parseDialArchive(file);

    expect(result.envelope).toEqual(envelope);
    expect(result.attachments.size).toBe(1);
    expect(
      new TextDecoder().decode(result.attachments.get('reports/q1.pdf')),
    ).toBe('pdf-bytes');
  });

  it('reads the envelope and attachments from an old-chat archive', async () => {
    const file = zipToFile({
      'conversations/conversations_history.json': strToU8(
        JSON.stringify(envelope),
      ),
      'res/reports/q1.pdf': strToU8('pdf-bytes'),
    });

    const result = await parseDialArchive(file);

    expect(result.envelope).toEqual(envelope);
    expect(result.attachments.get('reports/q1.pdf')).toBeDefined();
  });

  it('collects an attachment whose real-world filename has spaces and parentheses', async () => {
    const file = zipToFile({
      'conversation.json': strToU8(JSON.stringify(envelope)),
      'res/reports/q1 (final) report.pdf': strToU8('pdf-bytes'),
    });

    const result = await parseDialArchive(file);

    expect(
      result.attachments.get('reports/q1 (final) report.pdf'),
    ).toBeDefined();
  });

  it('rejects a traversal attachment path and does not include it', async () => {
    const file = zipToFile({
      'conversation.json': strToU8(JSON.stringify(envelope)),
      'res/../../etc/passwd': strToU8('malicious'),
    });

    const result = await parseDialArchive(file);

    expect(result.attachments.size).toBe(0);
  });

  it('throws when no conversation-JSON entry exists', async () => {
    const file = zipToFile({ 'res/reports/q1.pdf': strToU8('pdf-bytes') });

    await expect(parseDialArchive(file)).rejects.toThrow(
      UnsupportedImportFormatError,
    );
  });

  it('throws when the found JSON entry is not a supported v5 envelope', async () => {
    const file = zipToFile({
      'conversation.json': strToU8(JSON.stringify({ version: 3 })),
    });

    await expect(parseDialArchive(file)).rejects.toThrow(
      UnsupportedImportFormatError,
    );
  });

  it('throws for a file that is not a valid zip archive', async () => {
    const file = new File(['not a zip'], 'broken.dial');

    await expect(parseDialArchive(file)).rejects.toThrow(
      UnsupportedImportFormatError,
    );
  });
});
