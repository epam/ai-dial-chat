import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  buildPromptExportEnvelope,
  buildPromptExportFileName,
  serializePromptExport,
} from '../export-prompt';

/* jsdom's Blob has no `text()`, so the content is read through FileReader. */
const readBlobAsText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const makePrompt = (
  overrides: Partial<PromptResponseDto> = {},
): PromptResponseDto => ({
  id: 'Work/AI/summarize',
  bucket: 'my-bucket',
  name: 'summarize',
  description: 'Summarize a document',
  content: 'Summarize:\n\n{{document}}',
  folderId: 'Work/AI',
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
});

describe('buildPromptExportEnvelope', () => {
  it('wraps the prompt in a version 5 envelope', () => {
    const envelope = buildPromptExportEnvelope(makePrompt());

    expect(envelope.version).toBe(5);
    expect(envelope.prompts).toEqual([
      {
        id: 'Work/AI/summarize',
        name: 'summarize',
        description: 'Summarize a document',
        content: 'Summarize:\n\n{{document}}',
        folderId: 'Work/AI',
      },
    ]);
  });

  it('expands the folder path into a parent-linked chain, outermost first', () => {
    const envelope = buildPromptExportEnvelope(makePrompt());

    expect(envelope.folders).toEqual([
      { id: 'Work', name: 'Work' },
      { id: 'Work/AI', name: 'AI', folderId: 'Work' },
    ]);
  });

  it('emits no folders and no folderId for a root-level prompt', () => {
    const envelope = buildPromptExportEnvelope(makePrompt({ folderId: '' }));

    expect(envelope.folders).toEqual([]);
    expect('folderId' in envelope.prompts[0]).toBe(false);
  });

  it('substitutes an empty description when the prompt has none', () => {
    const envelope = buildPromptExportEnvelope(
      makePrompt({ description: undefined }),
    );

    expect(envelope.prompts[0].description).toBe('');
  });

  it('preserves variable placeholders in the body verbatim', () => {
    const envelope = buildPromptExportEnvelope(
      makePrompt({ content: 'Hi {{name}}, see {{ topic }}' }),
    );

    expect(envelope.prompts[0].content).toBe('Hi {{name}}, see {{ topic }}');
  });

  it('carries neither timestamps nor the author into the file', () => {
    const envelope = buildPromptExportEnvelope(makePrompt({ author: 'ada' }));

    expect(Object.keys(envelope.prompts[0]).sort()).toEqual([
      'content',
      'description',
      'folderId',
      'id',
      'name',
    ]);
  });
});

describe('serializePromptExport', () => {
  it('produces a pretty-printed application/json blob that round-trips', async () => {
    const envelope = buildPromptExportEnvelope(makePrompt());
    const blob = serializePromptExport(envelope);
    const text = await readBlobAsText(blob);

    expect(blob.type).toBe('application/json');
    expect(text).toContain('\n  ');
    expect(JSON.parse(text)).toEqual(envelope);
  });
});

describe('buildPromptExportFileName', () => {
  it('combines the date, app name, and prompt name', () => {
    expect(
      buildPromptExportFileName(
        'summarize',
        'ai_dial',
        new Date(2026, 7, 12, 15, 0),
      ),
    ).toBe('2026-08-12_ai_dial_prompt_summarize.json');
  });

  it('collapses spaces in the prompt name into underscores', () => {
    expect(
      buildPromptExportFileName(
        'Summarize long emails',
        'ai_dial',
        new Date(2026, 7, 12, 15, 0),
      ),
    ).toBe('2026-08-12_ai_dial_prompt_Summarize_long_emails.json');
  });

  it('replaces characters that would split the file name into segments', () => {
    expect(
      buildPromptExportFileName('a/b:c', 'ai_dial', new Date(2026, 7, 12)),
    ).toBe('2026-08-12_ai_dial_prompt_a_b_c.json');
  });

  it('keeps dots, dashes, and underscores from the prompt name', () => {
    expect(
      buildPromptExportFileName(
        'v1.2-final_x',
        'ai_dial',
        new Date(2026, 7, 12),
      ),
    ).toBe('2026-08-12_ai_dial_prompt_v1.2-final_x.json');
  });
});
