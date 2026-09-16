import { OverlayStageStatus } from '@epam/ai-dial-chat-overlay';
import {
  type Message,
  MessageRole,
  StageStatus,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { toOverlayMessages } from '../overlay-messages';

const makeMessage = (overrides?: Partial<Message>): Message => ({
  role: MessageRole.Assistant,
  content: 'Done',
  timestamp: '2026-09-14T10:00:00.000Z',
  ...overrides,
});

describe('toOverlayMessages', () => {
  it('projects role, content, and an index-based id', () => {
    const messages = [
      makeMessage({ role: MessageRole.User, content: 'Hi' }),
      makeMessage(),
    ];

    expect(toOverlayMessages(messages)).toEqual([
      { id: '0', role: MessageRole.User, content: 'Hi' },
      { id: '1', role: MessageRole.Assistant, content: 'Done' },
    ]);
  });

  it('carries the stages of a message that has them', () => {
    const messages = [
      makeMessage({
        custom_content: {
          stages: [
            {
              index: 0,
              name: 'Lookup available terms',
              status: StageStatus.Completed,
              content: 'found 3 terms',
              tag: 'MCP',
            },
            { index: 1, name: 'Render canvas', status: null },
          ],
        },
      }),
    ];

    expect(toOverlayMessages(messages)[0].stages).toEqual([
      {
        index: 0,
        name: 'Lookup available terms',
        status: OverlayStageStatus.Completed,
        content: 'found 3 terms',
        tag: 'MCP',
      },
      { index: 1, name: 'Render canvas', status: null },
    ]);
  });

  it('maps a failed stage to the protocol enum', () => {
    const messages = [
      makeMessage({
        custom_content: {
          stages: [{ index: 0, name: 'Call tool', status: StageStatus.Failed }],
        },
      }),
    ];

    expect(toOverlayMessages(messages)[0].stages?.[0].status).toBe(
      OverlayStageStatus.Failed,
    );
  });

  it('omits stages when the message has none, rather than sending an empty array', () => {
    const withoutCustomContent = toOverlayMessages([makeMessage()])[0];
    const withEmptyStages = toOverlayMessages([
      makeMessage({ custom_content: { stages: [] } }),
    ])[0];

    expect(withoutCustomContent).not.toHaveProperty('stages');
    expect(withEmptyStages).not.toHaveProperty('stages');
  });

  it('omits optional stage fields that are absent', () => {
    const [message] = toOverlayMessages([
      makeMessage({
        custom_content: {
          stages: [{ index: 0, name: 'Step', status: StageStatus.Completed }],
        },
      }),
    ]);

    expect(message.stages?.[0]).not.toHaveProperty('content');
    expect(message.stages?.[0]).not.toHaveProperty('tag');
  });
});
