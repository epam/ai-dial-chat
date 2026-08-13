import { parseScheduledTaskConversationPath } from './parse-scheduled-task-conversation-path';

describe('parseScheduledTaskConversationPath', () => {
  it('returns scheduleId and runId for a valid scheduler path', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toEqual({
      scheduleId: 'sched_abc',
      runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
    });
  });

  it('returns scheduleId and runId for a versioned deployment id', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/fed28845-d883-47e8-adc3-8a6afee464f7/gemini-3.1-flash-lite__gemini__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toEqual({
      scheduleId: 'fed28845-d883-47e8-adc3-8a6afee464f7',
      runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
    });
  });

  it('returns null for a normal conversation path', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/gpt-4o__Morning briefing__uuid',
      ),
    ).toBeNull();
  });

  it('returns null when the filename segment is missing', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc',
      ),
    ).toBeNull();
  });

  it('returns null when a segment is empty', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler//gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toBeNull();
  });

  it('returns null when scheduleId fails the allowlist (spaces and symbols)', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched abc!/gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toBeNull();
  });

  it('returns null when the filename has no trailing run UUID', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__Morning briefing',
      ),
    ).toBeNull();
  });

  it('returns null when there are extra segments after the filename', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5/extra',
      ),
    ).toBeNull();
  });

  it('decodes the scheduleId before validating', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched%5Fabc/gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toEqual({
      scheduleId: 'sched_abc',
      runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
    });
  });

  it('returns null when .scheduler appears at the wrong position', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/folder/.scheduler/sched_abc/gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toBeNull();
  });

  it('returns scheduleId and runId for a scheduled application deployment nested under applications/{applicationId}', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/8433fe2f-2ac7-4880-9869-31ea70f2c822/applications/test-bucket/MY%20Outlook%20Agent__0.0.1__EPM-RTC%20Issue%20Tracker__73482c36-2ff1-40e6-a6bf-e38a63a83f2c',
      ),
    ).toEqual({
      scheduleId: '8433fe2f-2ac7-4880-9869-31ea70f2c822',
      runId: '73482c36-2ff1-40e6-a6bf-e38a63a83f2c',
    });
  });

  it('returns scheduleId and runId for a scheduled application deployment nested under several folders', () => {
    expect(
      parseScheduledTaskConversationPath(
        'conversations/test-bucket/.scheduler/sched_abc/applications/some-bucket/nested/folder/gpt-4o__title__c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
      ),
    ).toEqual({
      scheduleId: 'sched_abc',
      runId: 'c7aeee4c-c01f-41f2-b0db-b8a1a39943f5',
    });
  });
});
