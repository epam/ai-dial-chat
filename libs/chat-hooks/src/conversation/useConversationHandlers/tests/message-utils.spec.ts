import {
  AttachmentType,
  MessageRole,
  RequestStatus,
  type Attachment,
  type DisplayAttachment,
  type Message,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  hasActiveToolConfig,
  isAnswerIncomplete,
  isMessageChanged,
  shouldRerunGenerationOnEdit,
} from '../message-utils';

const userMessage = (content = 'hello'): Message => ({
  role: MessageRole.User,
  content,
  timestamp: '2024-01-01T00:00:00.000Z',
});

const displayAttachment = (id: string): DisplayAttachment => ({
  id,
  name: id,
  contentType: 'application/octet-stream',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url: id,
});

const attachment = (url: string): Attachment => ({
  id: url,
  name: url,
  contentType: 'application/octet-stream',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  url,
  file: new File([], url),
});

describe('isMessageChanged', () => {
  describe('text only (no attachments)', () => {
    it('returns false when text is the same and no attachments exist', () => {
      const original = userMessage('hello');
      expect(isMessageChanged(original, 'hello', [], [])).toBe(false);
    });

    it('returns true when text differs', () => {
      const original = userMessage('hello');
      expect(isMessageChanged(original, 'world', [], [])).toBe(true);
    });
  });

  describe('with existing attachments', () => {
    const originalWithAttachments: Message = {
      role: MessageRole.User,
      content: 'hello',
      timestamp: '2024-01-01T00:00:00.000Z',
      custom_content: {
        attachments: [
          { type: 'application/octet-stream', title: 'a1', url: 'a1' },
          { type: 'application/octet-stream', title: 'a2', url: 'a2' },
        ],
      },
    };

    it('returns false when both attachments are kept unchanged', () => {
      const kept = [displayAttachment('a1'), displayAttachment('a2')];
      expect(isMessageChanged(originalWithAttachments, 'hello', kept, [])).toBe(
        false,
      );
    });

    it('returns true when one attachment is removed', () => {
      const kept = [displayAttachment('a1')];
      expect(isMessageChanged(originalWithAttachments, 'hello', kept, [])).toBe(
        true,
      );
    });

    it('returns true when a new attachment is added', () => {
      const kept = [displayAttachment('a1'), displayAttachment('a2')];
      const added = [attachment('a3')];
      expect(
        isMessageChanged(originalWithAttachments, 'hello', kept, added),
      ).toBe(true);
    });
  });

  describe('original message has no attachments', () => {
    it('returns true when a new attachment is added to a message without attachments', () => {
      const original = userMessage('hello');
      expect(isMessageChanged(original, 'hello', [], [attachment('a1')])).toBe(
        true,
      );
    });

    it('returns false when kept list is empty matching original zero attachments', () => {
      const original = userMessage('hello');
      expect(isMessageChanged(original, 'hello', [], [])).toBe(false);
    });
  });
});

describe('hasActiveToolConfig', () => {
  it('returns false when undefined', () => {
    expect(hasActiveToolConfig(undefined)).toBe(false);
  });

  it('returns false when empty', () => {
    expect(hasActiveToolConfig({})).toBe(false);
  });

  it('returns true when at least one entry is present', () => {
    expect(hasActiveToolConfig({ web: true })).toBe(true);
  });
});

describe('isAnswerIncomplete', () => {
  const answer = (overrides: Partial<Message> = {}): Message => ({
    role: MessageRole.Assistant,
    content: 'answer',
    timestamp: '2024-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('returns false for a completed answer', () => {
    expect(isAnswerIncomplete(answer())).toBe(false);
  });

  it('returns true when there is no answer at all', () => {
    expect(isAnswerIncomplete(undefined)).toBe(true);
  });

  it('returns true when the answer is not an assistant message', () => {
    expect(isAnswerIncomplete(userMessage())).toBe(true);
  });

  it('returns true when the user stopped the answer', () => {
    expect(isAnswerIncomplete(answer({ wasStoppedByUser: true }))).toBe(true);
  });

  it('returns true when the answer ended with a stream error', () => {
    expect(isAnswerIncomplete(answer({ streamErrorMessage: '' }))).toBe(true);
  });
});

describe('shouldRerunGenerationOnEdit', () => {
  const stoppedAnswer: Message = {
    role: MessageRole.Assistant,
    content: 'Partial',
    timestamp: '2024-01-01T00:00:00.000Z',
    wasStoppedByUser: true,
  };

  const completedAnswer: Message = {
    role: MessageRole.Assistant,
    content: 'Full answer',
    timestamp: '2024-01-01T00:00:00.000Z',
  };

  it('returns false when nothing changed and the answer is complete', () => {
    const messages = [userMessage('hello'), completedAnswer];
    expect(shouldRerunGenerationOnEdit(messages, 0, 'hello', [], [])).toBe(
      false,
    );
  });

  it('returns true when the text changed', () => {
    const messages = [userMessage('hello'), completedAnswer];
    expect(shouldRerunGenerationOnEdit(messages, 0, 'world', [], [])).toBe(
      true,
    );
  });

  it('returns true when nothing changed but the answer was stopped', () => {
    const messages = [userMessage('hello'), stoppedAnswer];
    expect(shouldRerunGenerationOnEdit(messages, 0, 'hello', [], [])).toBe(
      true,
    );
  });

  it('returns true when the edited message has no answer yet', () => {
    expect(
      shouldRerunGenerationOnEdit([userMessage('hello')], 0, 'hello', [], []),
    ).toBe(true);
  });

  it('returns false when the index holds no message', () => {
    expect(shouldRerunGenerationOnEdit([], 0, 'hello', [], [])).toBe(false);
  });
});
