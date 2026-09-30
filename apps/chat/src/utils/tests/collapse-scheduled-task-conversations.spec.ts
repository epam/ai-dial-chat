import type { ConversationListItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  applyActiveScheduledTaskRun,
  collapseScheduledTaskConversations,
  groupScheduledTaskConversations,
} from '../collapse-scheduled-task-conversations';
import { conversationIdsMatch } from '../conversation-id-match';

const conversation = (
  id: string,
  overrides: Partial<ConversationListItemDto> = {},
): ConversationListItemDto => ({
  id,
  title: id,
  updatedAt: 0,
  sharedWithMe: false,
  publishedWithMe: false,
  isPinned: false,
  isReadonly: false,
  isScheduledTask: false,
  ...overrides,
});

const run = (
  runId: string,
  overrides: Partial<ConversationListItemDto> & {
    bucket?: string;
    scheduleId?: string;
  } = {},
): ConversationListItemDto => {
  const { bucket = 'bucket', scheduleId = 's1', ...rest } = overrides;
  return conversation(
    `conversations/${bucket}/.scheduler/${scheduleId}/gpt-4__Daily%20digest__${runId}`,
    { isScheduledTask: true, scheduleId, runId, isUnread: false, ...rest },
  );
};

const collapse = (
  items: ConversationListItemDto[],
  activeConversationId?: string,
) =>
  collapseScheduledTaskConversations(items, {
    activeConversationId,
    conversationIdsMatch,
  });

const ids = (items: ConversationListItemDto[]) => items.map((item) => item.id);

describe('collapseScheduledTaskConversations', () => {
  it('keeps only the newest run of a task by creation time', () => {
    const first = run('a', { createdAt: 100 });
    const newest = run('b', { createdAt: 300 });
    const middle = run('c', { createdAt: 200 });

    expect(collapse([first, newest, middle])).toEqual([newest]);
  });

  it('prefers the later-created run over a later-updated one', () => {
    const repliedInLater = run('a', { createdAt: 100, updatedAt: 900 });
    const createdLater = run('b', { createdAt: 200, updatedAt: 200 });

    expect(collapse([repliedInLater, createdLater])).toEqual([createdLater]);
  });

  it('ranks runs without a creation time after runs that have one', () => {
    const dated = run('a', { createdAt: 100 });
    const undated = run('b', { updatedAt: 5000 });

    expect(collapse([undated, dated])).toEqual([dated]);
  });

  it('falls back to update time, then id, when creation times are missing', () => {
    const olderUpdate = run('z', { updatedAt: 100 });
    const newerUpdate = run('a', { updatedAt: 200 });
    expect(collapse([olderUpdate, newerUpdate])).toEqual([newerUpdate]);

    const sharedA = run('a', { bucket: 'owner', sharedWithMe: true });
    const sharedB = run('b', { bucket: 'owner', sharedWithMe: true });
    expect(collapse([sharedA, sharedB])).toEqual([sharedB]);
    expect(collapse([sharedB, sharedA])).toEqual([sharedB]);
  });

  it('does not collapse two different tasks into each other', () => {
    const taskOne = run('a', { scheduleId: 's1', createdAt: 100 });
    const taskTwo = run('b', { scheduleId: 's2', createdAt: 200 });

    expect(collapse([taskOne, taskTwo])).toEqual([taskOne, taskTwo]);
  });

  it('does not collapse the same schedule id from different buckets', () => {
    const own = run('a', { bucket: 'mine', createdAt: 100 });
    const shared = run('b', { bucket: 'other', sharedWithMe: true });

    expect(collapse([own, shared])).toEqual([own, shared]);
  });

  it('leaves ordinary conversations untouched and in their original order', () => {
    const chatOne = conversation('conversations/bucket/gpt-4__One');
    const older = run('a', { createdAt: 100 });
    const chatTwo = conversation('conversations/bucket/gpt-4__Two');
    const newer = run('b', { createdAt: 200 });
    const chatThree = conversation('conversations/bucket/gpt-4__Three');

    expect(ids(collapse([chatOne, older, chatTwo, newer, chatThree]))).toEqual(
      ids([chatOne, chatTwo, newer, chatThree]),
    );
  });

  it('keeps a pinned run as its own row next to the newest unpinned run', () => {
    const pinned = run('a', { createdAt: 100, isPinned: true });
    const older = run('b', { createdAt: 200 });
    const newest = run('c', { createdAt: 300 });

    expect(collapse([pinned, older, newest])).toEqual([pinned, newest]);
  });

  it('shows the open older run in place of the newest run of its task', () => {
    const older = run('b', { createdAt: 100 });
    const newest = run('c', { createdAt: 200 });

    const routeId = older.id.replace(/^conversations\//, '');

    expect(collapse([newest, older], routeId)).toEqual([older]);
    expect(collapse([older, newest], older.id)).toEqual([older]);
  });

  it('ignores an active conversation that belongs to another task', () => {
    const otherTask = run('x', { scheduleId: 's2' });
    const older = run('b', { createdAt: 100 });
    const newest = run('c', { createdAt: 200 });

    expect(collapse([older, newest, otherTask], otherTask.id)).toEqual([
      newest,
      otherTask,
    ]);
  });

  it('promotes the next run once the shown run is removed from the list', () => {
    const older = run('a', { createdAt: 100 });
    const newest = run('b', { createdAt: 200 });

    expect(collapse([older, newest])).toEqual([newest]);
    expect(collapse([older])).toEqual([older]);
  });

  it('shows no row for a task once its last run is removed', () => {
    const chat = conversation('conversations/bucket/gpt-4__Chat');

    expect(collapse([chat])).toEqual([chat]);
  });

  it('does not mutate the input list', () => {
    const items = Object.freeze([
      run('a', { createdAt: 100 }),
      run('b', { createdAt: 200 }),
    ]);

    const result = collapse(items as ConversationListItemDto[]);

    expect(result).not.toBe(items);
    expect(items).toHaveLength(2);
  });
});

describe('groupScheduledTaskConversations + applyActiveScheduledTaskRun', () => {
  const group = (items: ConversationListItemDto[]) =>
    groupScheduledTaskConversations(items, { conversationIdsMatch });

  const chatOne = conversation('conversations/bucket/gpt-4__One');
  const chatTwo = conversation('conversations/bucket/gpt-4__Two');
  const older = run('b', { createdAt: 100 });
  const newest = run('c', { createdAt: 200 });

  it('keeps the collapsed list reference when an ordinary conversation is active', () => {
    const grouping = group([chatOne, older, newest, chatTwo]);

    const first = applyActiveScheduledTaskRun(grouping, chatOne.id);
    const second = applyActiveScheduledTaskRun(grouping, chatTwo.id);

    expect(second).toBe(first);
    expect(ids(first)).toEqual(ids([chatOne, newest, chatTwo]));
  });

  it('keeps the collapsed list reference for no active id or an unknown id', () => {
    const grouping = group([chatOne, older, newest]);
    const base = applyActiveScheduledTaskRun(grouping, undefined);

    expect(applyActiveScheduledTaskRun(grouping, 'conversations/nope')).toBe(
      base,
    );
  });

  it('keeps the collapsed list reference when the newest run is active', () => {
    const grouping = group([older, newest]);
    const base = applyActiveScheduledTaskRun(grouping, undefined);

    const result = applyActiveScheduledTaskRun(grouping, newest.id);

    expect(result).toBe(base);
    expect(result).toEqual([newest]);
  });

  it('returns a new list showing an active older run', () => {
    const grouping = group([chatOne, newest, older]);
    const base = applyActiveScheduledTaskRun(grouping, undefined);

    const result = applyActiveScheduledTaskRun(grouping, older.id);

    expect(result).not.toBe(base);
    expect(ids(result)).toEqual(ids([chatOne, older]));
  });

  const pinned = run('p', { createdAt: 50, isPinned: true });
  const otherTask = run('x', { scheduleId: 's2' });
  const shared = run('s', { bucket: 'other', sharedWithMe: true });
  const cases: Array<[string, ConversationListItemDto[], string | undefined]> =
    [
      ['no active id', [chatOne, older, newest, pinned, chatTwo], undefined],
      ['ordinary active', [chatOne, older, newest], chatTwo.id],
      ['older run active', [newest, chatOne, older], older.id],
      [
        'older run active via route id',
        [newest, older],
        older.id.replace(/^conversations\//, ''),
      ],
      ['pinned run active', [pinned, older, newest], pinned.id],
      ['other task active', [older, newest, otherTask], otherTask.id],
      ['other bucket', [older, shared, newest], shared.id],
    ];

  it.each(cases)(
    'matches the single-pass result (%s)',
    (_label, items, activeId) => {
      expect(applyActiveScheduledTaskRun(group(items), activeId)).toEqual(
        collapse(items, activeId),
      );
    },
  );
});
