import { MessageRole, StageStatus } from '@epam/ai-dial-chat-shared';
import type { Message, StreamChunk } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { applyChunkToMessages } from '../apply-chunk';

const makeAssistantMessage = (overrides?: Partial<Message>): Message => ({
  role: MessageRole.Assistant,
  content: '',
  timestamp: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const makeChunk = (
  content: string,
  partial?: Partial<StreamChunk['choices'][0]['delta']>,
): StreamChunk => ({
  id: 'chunk-id',
  object: 'chat.completion.chunk',
  choices: [
    {
      delta: { content, ...partial },
      finish_reason: null,
      index: 0,
    },
  ],
});

describe('applyChunkToMessages', () => {
  it('returns null when chunk carries no actionable data', () => {
    const messages = [makeAssistantMessage()];
    const chunk = makeChunk('');
    expect(applyChunkToMessages(messages, 0, chunk)).toBeNull();
  });

  it('appends text content to the target message', () => {
    const messages = [makeAssistantMessage({ content: 'Hello' })];
    const result = applyChunkToMessages(messages, 0, makeChunk(' world'));
    expect(result![0].content).toBe('Hello world');
  });

  it('does not modify messages at other indexes', () => {
    const messages = [
      makeAssistantMessage({ content: 'A' }),
      makeAssistantMessage({ content: 'B' }),
    ];
    const result = applyChunkToMessages(messages, 0, makeChunk(' plus'));
    expect(result![0].content).toBe('A plus');
    expect(result![1].content).toBe('B');
  });
});

describe('applyChunkToMessages — stage merging', () => {
  it('adds a new stage when none exists', () => {
    const messages = [makeAssistantMessage()];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [{ index: 0, name: 'Stage', status: null }],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    expect(result[0].custom_content?.stages).toHaveLength(1);
    expect(result[0].custom_content?.stages![0].name).toBe('Stage');
  });

  it('concatenates stage name across chunks', () => {
    const messages = [
      makeAssistantMessage({
        custom_content: {
          stages: [{ index: 0, name: 'Stage', status: null }],
        },
      }),
    ];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [{ index: 0, name: ' B', status: null }],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    expect(result[0].custom_content?.stages![0].name).toBe('Stage B');
  });

  it('updates stage status without losing attachments', () => {
    const messages = [
      makeAssistantMessage({
        custom_content: {
          stages: [
            {
              index: 0,
              name: 'Lookup',
              status: null,
              attachments: [
                {
                  index: 0,
                  type: 'text/markdown',
                  title: '[1] Result',
                  data: 'Markdown content',
                },
              ],
            },
          ],
        },
      }),
    ];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [{ index: 0, name: '', status: StageStatus.Completed }],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    const stage = result[0].custom_content?.stages![0];
    expect(stage?.status).toBe(StageStatus.Completed);
    expect(stage?.attachments).toHaveLength(1);
    expect(stage?.attachments![0].data).toBe('Markdown content');
  });

  it('concatenates stage attachment data across chunks', () => {
    const messages = [
      makeAssistantMessage({
        custom_content: {
          stages: [
            {
              index: 0,
              name: 'Lookup',
              status: null,
              attachments: [
                {
                  index: 0,
                  type: 'text/markdown',
                  title: '[1] ',
                  data: 'Part one ',
                },
              ],
            },
          ],
        },
      }),
    ];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [
          {
            index: 0,
            name: '',
            status: StageStatus.Completed,
            attachments: [
              {
                index: 0,
                type: 'text/markdown',
                title: 'Result',
                data: 'part two',
              },
            ],
          },
        ],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    const att = result[0].custom_content?.stages![0].attachments![0];
    expect(att?.title).toBe('[1] Result');
    expect(att?.data).toBe('Part one part two');
  });

  it('preserves existing attachment data when incoming attachment has no data', () => {
    const messages = [
      makeAssistantMessage({
        custom_content: {
          stages: [
            {
              index: 0,
              name: 'Lookup',
              status: null,
              attachments: [
                {
                  index: 0,
                  type: 'text/markdown',
                  title: 'Result',
                  data: 'Full markdown',
                },
              ],
            },
          ],
        },
      }),
    ];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [
          {
            index: 0,
            name: '',
            status: StageStatus.Completed,
            attachments: [{ index: 0, type: 'text/markdown', title: '' }],
          },
        ],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    const att = result[0].custom_content?.stages![0].attachments![0];
    expect(att?.data).toBe('Full markdown');
  });

  it('appends new attachments with a different index', () => {
    const messages = [
      makeAssistantMessage({
        custom_content: {
          stages: [
            {
              index: 0,
              name: 'Lookup',
              status: null,
              attachments: [
                { index: 0, type: 'text/plain', title: 'First', data: 'A' },
              ],
            },
          ],
        },
      }),
    ];
    const chunk = makeChunk('', {
      custom_content: {
        stages: [
          {
            index: 0,
            name: '',
            status: StageStatus.Completed,
            attachments: [
              { index: 1, type: 'text/plain', title: 'Second', data: 'B' },
            ],
          },
        ],
      },
    });
    const result = applyChunkToMessages(messages, 0, chunk)!;
    const atts = result[0].custom_content?.stages?.[0].attachments;
    expect(atts).toHaveLength(2);
    expect(atts?.[0].data).toBe('A');
    expect(atts?.[1].data).toBe('B');
  });
});
