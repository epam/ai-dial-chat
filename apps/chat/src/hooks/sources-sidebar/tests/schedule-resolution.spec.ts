import type { ScheduledTaskRunDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  findConversationScheduleId,
  isSameTaskSwitch,
  mergeRunConversationIds,
  nextObservedSubject,
  nextRememberedSchedule,
  resolveSubjectScheduleId,
  type ObservedSubject,
  type RememberedSchedule,
} from '../schedule-resolution';

/* One run of a loaded history, keyed by its conversation id. */
const makeRun = (conversationId: string): ScheduledTaskRunDto => ({
  id: conversationId,
  status: 'Success',
  startTime: '2026-07-24T09:00:00.000Z',
  conversationId,
});

const rememberedSchedule: RememberedSchedule = {
  scheduleId: 'schedule-1',
  runConversationIds: new Set([
    'conversations/bucket/.scheduler/schedule-1/run-1',
    'conversations/bucket/.scheduler/schedule-1/run-2',
  ]),
};

describe('findConversationScheduleId', () => {
  it('returns the schedule id for a remembered run conversation id', () => {
    expect(
      findConversationScheduleId(
        rememberedSchedule,
        'conversations/bucket/.scheduler/schedule-1/run-1',
      ),
    ).toBe('schedule-1');
  });

  it('matches the route form of the conversation id without the conversations/ prefix', () => {
    expect(
      findConversationScheduleId(
        rememberedSchedule,
        'bucket/.scheduler/schedule-1/run-2',
      ),
    ).toBe('schedule-1');
  });

  it('returns null for a conversation no remembered run shows', () => {
    expect(
      findConversationScheduleId(rememberedSchedule, 'bucket/plain-chat'),
    ).toBeNull();
  });

  it('returns null without a remembered schedule or a conversation id', () => {
    expect(findConversationScheduleId(null, 'bucket/plain-chat')).toBeNull();
    expect(findConversationScheduleId(rememberedSchedule, null)).toBeNull();
  });
});

describe('resolveSubjectScheduleId', () => {
  it('returns the resolved scheduleId without the remembered lookup', () => {
    const subject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    };

    expect(resolveSubjectScheduleId(subject, null)).toBe('schedule-1');
  });

  it('falls back to the remembered schedule for an unresolved subject', () => {
    const subject: ObservedSubject = {
      conversationId: 'conversations/bucket/.scheduler/schedule-1/run-2',
    };

    expect(resolveSubjectScheduleId(subject, rememberedSchedule)).toBe(
      'schedule-1',
    );
  });

  it('returns null when neither the subject nor the memory resolves', () => {
    const subject: ObservedSubject = { conversationId: 'bucket/plain-chat' };

    expect(resolveSubjectScheduleId(subject, rememberedSchedule)).toBeNull();
  });
});

describe('nextRememberedSchedule', () => {
  it('returns the remembered schedule unchanged while no schedule resolves', () => {
    expect(nextRememberedSchedule(rememberedSchedule, undefined, [])).toBe(
      rememberedSchedule,
    );
    expect(nextRememberedSchedule(null, undefined, [])).toBeNull();
  });

  it('absorbs the loaded run ids for the same schedule', () => {
    const next = nextRememberedSchedule(rememberedSchedule, 'schedule-1', [
      makeRun('conversations/bucket/.scheduler/schedule-1/run-3'),
    ]);

    expect(next?.scheduleId).toBe('schedule-1');
    expect(
      next?.runConversationIds.has(
        'conversations/bucket/.scheduler/schedule-1/run-3',
      ),
    ).toBe(true);
  });

  it('starts empty on a schedule change', () => {
    const next = nextRememberedSchedule(rememberedSchedule, 'schedule-2', [
      makeRun('conversations/bucket/.scheduler/schedule-1/run-1'),
    ]);

    expect(next).toEqual({
      scheduleId: 'schedule-2',
      runConversationIds: new Set<string>(),
    });
  });
});

describe('mergeRunConversationIds', () => {
  it('extends the remembered run ids with the run ids the history shows', () => {
    const merged = mergeRunConversationIds(
      rememberedSchedule.runConversationIds,
      [makeRun('conversations/bucket/.scheduler/schedule-1/run-3')],
    );

    expect(merged.has('conversations/bucket/.scheduler/schedule-1/run-1')).toBe(
      true,
    );
    expect(merged.has('conversations/bucket/.scheduler/schedule-1/run-3')).toBe(
      true,
    );
  });

  it('skips runs without a conversation id', () => {
    const merged = mergeRunConversationIds(
      rememberedSchedule.runConversationIds,
      [{ ...makeRun('unused'), conversationId: undefined }],
    );

    expect(merged).toEqual(rememberedSchedule.runConversationIds);
  });

  it('does not mutate the remembered run ids', () => {
    mergeRunConversationIds(rememberedSchedule.runConversationIds, [
      makeRun('conversations/bucket/.scheduler/schedule-1/run-3'),
    ]);

    expect(
      rememberedSchedule.runConversationIds.has(
        'conversations/bucket/.scheduler/schedule-1/run-3',
      ),
    ).toBe(false);
  });
});

describe('nextObservedSubject', () => {
  it('records the resolved scheduleId for a new conversation', () => {
    expect(
      nextObservedSubject(
        null,
        'bucket/.scheduler/schedule-1/run-1',
        'schedule-1',
      ),
    ).toEqual({
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    });
  });

  it('keeps the last resolved scheduleId across a resolve blip on the same conversation', () => {
    const previousSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    };

    expect(
      nextObservedSubject(
        previousSubject,
        'bucket/.scheduler/schedule-1/run-1',
        undefined,
      ),
    ).toEqual({
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    });
  });

  it('drops the scheduleId when the conversation changes and nothing resolves', () => {
    const previousSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    };

    expect(
      nextObservedSubject(previousSubject, 'bucket/plain-chat', undefined),
    ).toEqual({ conversationId: 'bucket/plain-chat' });
  });
});

describe('isSameTaskSwitch', () => {
  it('is true for two runs of the same remembered schedule', () => {
    const previousSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    };
    const currentSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-2',
    };

    expect(
      isSameTaskSwitch(previousSubject, currentSubject, rememberedSchedule),
    ).toBe(true);
  });

  it('is false for a switch to another schedule', () => {
    const previousSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-1/run-1',
      scheduleId: 'schedule-1',
    };
    const currentSubject: ObservedSubject = {
      conversationId: 'bucket/.scheduler/schedule-2/run-1',
      scheduleId: 'schedule-2',
    };

    expect(
      isSameTaskSwitch(previousSubject, currentSubject, rememberedSchedule),
    ).toBe(false);
  });

  it('is false when both sides resolve to no schedule', () => {
    const previousSubject: ObservedSubject = {
      conversationId: 'bucket/plain-chat-1',
    };
    const currentSubject: ObservedSubject = {
      conversationId: 'bucket/plain-chat-2',
    };

    expect(
      isSameTaskSwitch(previousSubject, currentSubject, rememberedSchedule),
    ).toBe(false);
  });
});
