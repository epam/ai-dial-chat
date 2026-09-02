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

  it('normalizes and persists raw custom_fields.annotations with two distinct html_tag entries', () => {
    const msg = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_fields: {
          annotations: [
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: 'e43864' },
              },
              body: {
                title: 'MT_14dayTrialNote (2).pdf',
                quote: 'Patient meets ALL criteria',
                source: {
                  type: 'attachment',
                  url: 'files/acc/uploads/MT_14dayTrialNote%20(2).pdf',
                },
              },
            },
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: 'e52dc2' },
              },
              body: {
                title: 'MT_14dayTrialNote (2).pdf',
                quote: 'Recommend proceeding with Stage 2',
                source: {
                  type: 'attachment',
                  url: 'files/acc/uploads/MT_14dayTrialNote%20(2).pdf',
                },
              },
            },
          ],
        },
      }),
    );
    const annotations = (
      msg.custom_content as {
        annotations: {
          target: { selector: { id: string } };
          body: { source: { attachment: { type: string } } };
        }[];
      }
    ).annotations;
    expect(annotations).toHaveLength(2);
    expect(annotations.map((a) => a.target.selector.id)).toEqual([
      'e43864',
      'e52dc2',
    ]);
    expect(annotations[0].body.source.attachment.type).toBe(
      'application/pdf',
    );
  });

  it('infers text/html for an html_tag annotation citing an .html URL', () => {
    const msg = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_fields: {
          annotations: [
            {
              target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
              body: {
                title: 'page.html',
                source: { type: 'attachment', url: 'https://example.com/page.html' },
              },
            },
          ],
        },
      }),
    );
    const annotations = (
      msg.custom_content as {
        annotations: { body: { source: { attachment: { type: string } } } }[];
      }
    ).annotations;
    expect(annotations[0].body.source.attachment.type).toBe('text/html');
  });

  it('still normalizes the legacy attachment_index raw annotation shape', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_content: {
          attachments: [
            { index: 0, type: 'application/pdf', title: 'report.pdf', url: 'files/report.pdf' },
          ],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_fields: {
          annotations: [
            {
              index: 0,
              target: {
                source: { attachment_index: 0 },
                selector: {
                  type: 'pdf_region',
                  page: 1,
                  bbox: { left: 1, top: 2, width: 3, height: 4 },
                },
              },
              body: { title: 'Section 1' },
            },
          ],
        },
      }),
    );
    const annotations = (
      msg2.custom_content as {
        annotations: {
          body: { source: { attachment: { url: string } } };
        }[];
      }
    ).annotations;
    expect(annotations).toHaveLength(1);
    expect(annotations[0].body.source.attachment.url).toBe(
      'files/report.pdf',
    );
  });

  it('merges a later chunk for the same cit id into the existing entry', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({
        custom_fields: {
          annotations: [
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: 'e1' },
              },
              body: {
                quote: 'Patient',
                source: { type: 'attachment', url: 'files/doc.pdf' },
              },
            },
          ],
        },
      }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({
        custom_fields: {
          annotations: [
            {
              target: {
                selector: { type: 'html_tag', tag: 'cit', id: 'e1' },
              },
              body: {
                quote: ' meets criteria',
                source: { type: 'attachment', url: 'files/doc.pdf' },
              },
            },
          ],
        },
      }),
    );
    const annotations = (
      msg2.custom_content as {
        annotations: { body: { quote: string } }[];
      }
    ).annotations;
    expect(annotations).toHaveLength(1);
    expect(annotations[0].body.quote).toBe('Patient meets criteria');
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

  it('overwrites state (last wins) rather than merging it', () => {
    const msg1 = applyChunkToMessage(
      baseMessage(),
      makeChunk({ custom_content: { state: { step: 1 } } }),
    );
    const msg2 = applyChunkToMessage(
      msg1,
      makeChunk({ custom_content: { state: { step: 2 } } }),
    );
    expect((msg2.custom_content as { state: unknown }).state).toEqual({
      step: 2,
    });
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
