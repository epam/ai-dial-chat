import { ConversationMessageRole } from '../dto/conversation-message.dto';
import { applyChunkToMessage } from './apply-chunk.server';

const baseMessage = () => ({
  id: 'msg-1',
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: '2026-01-01T00:00:00.000Z',
});

const makeChunk = (delta: Record<string, unknown>, id = 'chunk-id') => ({
  id,
  choices: [{ delta }],
});

describe('applyChunkToMessage', () => {
  it('concatenates text content across chunks', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({ content: 'Hello' }),
    );
    const msg2 = applyChunkToMessage(msg1, makeChunk({ content: ' world' }));
    expect(msg2.content).toBe('Hello world');
  });

  it('returns unchanged message for empty chunk', () => {
    const msg = baseMessage();
    const result = applyChunkToMessage(msg, makeChunk({}));
    expect(result).toBe(msg);
  });

  it('accumulates attachments across chunks', () => {
    const att1 = {
      type: 'text/plain',
      title: 'a.txt',
      url: 'https://example.com/a',
    };
    const att2 = {
      type: 'text/plain',
      title: 'b.txt',
      url: 'https://example.com/b',
    };
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({ custom_content: { attachments: [att1] } }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({ custom_content: { attachments: [att2] } }),
    );
    expect(
      (msg2.custom_content as { attachments: unknown[] }).attachments,
    ).toEqual([att1, att2]);
  });

  it('merges stages by index', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          stages: [{ index: 0, name: 'St', content: 'part1' }],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_content: {
          stages: [{ index: 0, name: 'age', content: 'part2' }],
        },
      }),
    );
    const stages = (
      msg2.custom_content as { stages: { name: string; content: string }[] }
    ).stages;
    expect(stages[0].name).toBe('Stage');
    expect(stages[0].content).toBe('part1part2');
  });

  it('normalizes a null name on the first chunk for a new stage (DIAL Core "stage opened" signal)', () => {
    const msg = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          stages: [{ index: 0, name: null, status: null }],
        },
      }),
    );
    const stages = (msg.custom_content as { stages: { name: string }[] })
      .stages;
    expect(stages[0].name).toBe('');
  });

  it('preserves explicitly empty stage content while merging stage updates', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          stages: [{ index: 0, name: 'Header', content: '' }],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_content: {
          stages: [{ index: 0, attachments: [{ title: 'log' }] }],
        },
      }),
    );
    const stages = (msg2.custom_content as { stages: { content?: string }[] })
      .stages;

    expect(stages[0].content).toBe('');
  });

  it('merges annotations by index', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          annotations: [{ index: 0, body: { title: 'Ti', quote: 'Qu' } }],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_content: {
          annotations: [{ index: 0, body: { title: 'tle', quote: 'ote' } }],
        },
      }),
    );
    const annotations = (
      msg2.custom_content as {
        annotations: { body: { title: string; quote: string } }[];
      }
    ).annotations;
    expect(annotations[0].body.title).toBe('Title');
    expect(annotations[0].body.quote).toBe('Quote');
  });

  it('replaces form_schema (last wins)', () => {
    const schema1 = { type: 'object', properties: { a: {} } };
    const schema2 = { type: 'object', properties: { b: {} } };
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({ custom_content: { form_schema: schema1 } }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({ custom_content: { form_schema: schema2 } }),
    );
    expect(
      (msg2.custom_content as { form_schema: unknown }).form_schema,
    ).toEqual(schema2);
  });

  it('appends a new reasoning-summary key', () => {
    const msg = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          reasoning_summaries: [
            {
              itemId: 'rs_1',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Checking',
            },
          ],
        },
      }),
    );
    const summaries = (
      msg.custom_content as { reasoning_summaries: { text: string }[] }
    ).reasoning_summaries;
    expect(summaries).toEqual([
      { itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'Checking' },
    ]);
  });

  it('concatenates text for an existing reasoning-summary key', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          reasoning_summaries: [
            { itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'Check' },
          ],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_content: {
          reasoning_summaries: [
            { itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'ing' },
          ],
        },
      }),
    );
    const summaries = (
      msg2.custom_content as { reasoning_summaries: { text: string }[] }
    ).reasoning_summaries;
    expect(summaries[0].text).toBe('Checking');
  });

  it('leaves existing reasoning-summary entries unchanged when a chunk carries none', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          reasoning_summaries: [
            {
              itemId: 'rs_1',
              outputIndex: 0,
              summaryIndex: 0,
              text: 'Checking',
            },
          ],
        },
      }),
    );
    const msg2 = applyChunkToMessage(msg1, makeChunk({ content: 'hi' }));
    const summaries = (
      msg2.custom_content as { reasoning_summaries: { text: string }[] }
    ).reasoning_summaries;
    expect(summaries).toEqual([
      { itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'Checking' },
    ]);
  });

  it('merges a Responses-origin stage carrying toolKind the same way as any other stage', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          stages: [
            {
              index: 0,
              status: null,
              name: 'Web Search',
              tag: 'Web Search',
              toolKind: 'web_search',
            },
          ],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_content: { stages: [{ index: 0, status: 'completed' }] },
      }),
    );
    const stages = (
      msg2.custom_content as {
        stages: { status: string | null; toolKind?: string }[];
      }
    ).stages;
    expect(stages[0].status).toBe('completed');
    expect(stages[0].toolKind).toBe('web_search');
  });

  it('sets responseId from delta.responseId', () => {
    const result = applyChunkToMessage(
      baseMessage(),
      makeChunk({ content: 'hi', responseId: 'resp-abc' }),
    );
    expect((result as { responseId?: string }).responseId).toBe('resp-abc');
  });

  it('falls back to chunk.id for responseId when no delta.responseId', () => {
    const result = applyChunkToMessage(
      baseMessage(),
      makeChunk({ content: 'hi' }, 'chunk-xyz'),
    );
    expect((result as { responseId?: string }).responseId).toBe('chunk-xyz');
  });
});
