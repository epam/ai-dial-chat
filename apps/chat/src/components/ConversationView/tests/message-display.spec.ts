import {
  MessageRole,
  StageStatus,
  type Message,
  type Stage,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getInputMessageHistory,
  prepareStageCitations,
} from '../utils/message-display';

const MESSAGES: Message[] = [
  {
    role: MessageRole.User,
    content: 'first question',
    timestamp: '2024-01-01T00:00:00Z',
  },
  {
    role: MessageRole.Assistant,
    content: 'first answer',
    timestamp: '2024-01-01T00:00:01Z',
  },
  {
    role: MessageRole.User,
    content: 'second question',
    timestamp: '2024-01-01T00:00:02Z',
  },
];

describe('getInputMessageHistory', () => {
  it('returns the sent user messages in order when navigation is enabled', () => {
    expect(getInputMessageHistory(MESSAGES, false)).toEqual([
      'first question',
      'second question',
    ]);
  });

  /* disable-input-history-navigation: with no history the input's Up/Down
     handler has nothing to recall (covered by useInputHistoryNavigation.spec). */
  it('returns undefined when navigation is disabled, even with sent messages', () => {
    expect(getInputMessageHistory(MESSAGES, true)).toBeUndefined();
  });
});

describe('prepareStageCitations', () => {
  const stage = (index: number, content?: string): Stage => ({
    index,
    name: `Step ${index}`,
    status: StageStatus.Completed,
    content,
  });

  it('hides complete citation elements while streaming', () => {
    const [prepared] = prepareStageCitations(
      [stage(0, 'Found<cit data-id="c1"></cit>.')],
      true,
    );

    expect(prepared.content).toBe('Found.');
  });

  it('keeps supported elements and escapes malformed ones once finished', () => {
    const [prepared] = prepareStageCitations(
      [stage(0, '<cit data-id="c1"></cit> <cit data-id="c2></cit>')],
      false,
    );

    expect(prepared.content).toBe(
      '<cit data-id="c1"></cit> &lt;cit data-id="c2&gt;&lt;/cit&gt;',
    );
  });

  it('keeps stages without citation markup by reference', () => {
    const plain = stage(0, 'No citations here');
    const noContent = stage(1);
    const cited = stage(2, 'Found<cit data-id="c1"></cit>.');

    const prepared = prepareStageCitations([plain, noContent, cited], false);

    expect(prepared[0]).toBe(plain);
    expect(prepared[1]).toBe(noContent);
  });

  it('returns the same array when no stage carries citation markup', () => {
    const stages = [stage(0, 'plain'), stage(1)];

    expect(prepareStageCitations(stages, true)).toBe(stages);
  });
});
