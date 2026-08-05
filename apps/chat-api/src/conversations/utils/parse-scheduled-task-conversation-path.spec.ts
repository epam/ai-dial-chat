import { parseScheduledTaskConversationPath } from './parse-scheduled-task-conversation-path';

describe('parseScheduledTaskConversationPath', () => {
  it('returns scheduleId and runId for a valid scheduler path', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/run_001/gpt-4o__Morning briefing__uuid',
      ),
    ).toEqual({ scheduleId: 'sched_abc', runId: 'run_001' });
  });

  it('returns null for a normal conversation path', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/gpt-4o__Morning briefing__uuid',
      ),
    ).toBeNull();
  });

  it('returns null when the runId segment is missing', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc',
      ),
    ).toBeNull();
  });

  it('returns null when a segment is empty', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler//run_001/title',
      ),
    ).toBeNull();
  });

  it('returns null when scheduleId fails the allowlist (spaces and symbols)', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched abc!/run_001/title',
      ),
    ).toBeNull();
  });

  it('returns null when runId contains a path traversal attempt', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/../title',
      ),
    ).toBeNull();
  });

  it('decodes URL-encoded ids before validating', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched%5Fabc/run%5F001/title',
      ),
    ).toEqual({ scheduleId: 'sched_abc', runId: 'run_001' });
  });

  it('returns null when .scheduler appears at the wrong position', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/folder/.scheduler/sched_abc/run_001',
      ),
    ).toBeNull();
  });
});
