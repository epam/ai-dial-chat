import {
  type Attachment,
  AttachmentType,
  type DisplayAttachment,
  type Message,
  type Stage,
  MessageRole,
  RequestStatus,
  StageStatus,
  StatusEvent,
  ToolStageKind,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getLastDeploymentId,
  getReasoningSummaryText,
  isMessageChanged,
  isMessageStreaming,
  messageHasStages,
  resolveToolStageLabels,
} from '../message-utils';

/*
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

const userMessage = (content = 'hello'): Message => ({
  role: MessageRole.User,
  content,
  timestamp: '2024-01-01T00:00:00.000Z',
});

const assistantMessage = (content = 'hi'): Message => ({
  role: MessageRole.Assistant,
  content,
  timestamp: '2024-01-01T00:00:00.000Z',
});

const statusModelChanged = (newId: string): Message =>
  ({
    role: MessageRole.Status,
    content: '',
    custom_content: {
      event_type: StatusEvent.ModelChanged,
      new_deployment_id: newId,
    },
  }) as unknown as Message;

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

/*
 * ---------------------------------------------------------------------------
 * isMessageStreaming
 * ---------------------------------------------------------------------------
 */

describe('isMessageStreaming', () => {
  it('returns true for the last assistant message while streaming', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 2, 3, true)).toBe(true);
  });

  it('returns false when isAssistantTyping is false', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 2, 3, false)).toBe(false);
  });

  it('returns false when the message is not the last one', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 1, 3, true)).toBe(false);
  });

  it('returns false for a user message even if it is last and typing is true', () => {
    const msg = userMessage();
    expect(isMessageStreaming(msg, 2, 3, true)).toBe(false);
  });
});

/*
 * ---------------------------------------------------------------------------
 * getLastDeploymentId
 * ---------------------------------------------------------------------------
 */

describe('getLastDeploymentId', () => {
  it('returns null for an empty list', () => {
    expect(getLastDeploymentId([])).toBeNull();
  });

  it('returns null when there are no model_changed status messages', () => {
    expect(getLastDeploymentId([userMessage(), assistantMessage()])).toBeNull();
  });

  it('returns the deployment id from the last model_changed event', () => {
    const messages: Message[] = [
      userMessage(),
      statusModelChanged('model-a'),
      userMessage(),
      statusModelChanged('model-b'),
      assistantMessage(),
    ];
    expect(getLastDeploymentId(messages)).toBe('model-b');
  });

  it('returns the only deployment id when there is one model_changed event', () => {
    expect(
      getLastDeploymentId([userMessage(), statusModelChanged('model-x')]),
    ).toBe('model-x');
  });
});

/*
 * ---------------------------------------------------------------------------
 * isMessageChanged
 * ---------------------------------------------------------------------------
 */

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

    it('returns false when text unchanged and all attachments kept', () => {
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

    it('returns true when an attachment is removed and a new one added', () => {
      const kept = [displayAttachment('a1')];
      const added = [attachment('a3')];
      expect(
        isMessageChanged(originalWithAttachments, 'hello', kept, added),
      ).toBe(true);
    });

    it('returns true when text also changed alongside attachment changes', () => {
      const kept = [displayAttachment('a1'), displayAttachment('a2')];
      expect(
        isMessageChanged(originalWithAttachments, 'changed', kept, []),
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

/*
 * ---------------------------------------------------------------------------
 * messageHasStages
 * ---------------------------------------------------------------------------
 */

describe('messageHasStages', () => {
  it('returns false for a user message', () => {
    expect(messageHasStages(userMessage())).toBe(false);
  });

  it('returns false for an assistant message with no stages', () => {
    expect(messageHasStages(assistantMessage())).toBe(false);
  });

  it('returns false for an assistant message with an empty stages array', () => {
    const msg: Message = {
      role: MessageRole.Assistant,
      content: '',
      timestamp: '2024-01-01T00:00:00.000Z',
      custom_content: { stages: [] },
    };
    expect(messageHasStages(msg)).toBe(false);
  });

  it('returns true for an assistant message with at least one stage', () => {
    const msg: Message = {
      role: MessageRole.Assistant,
      content: '',
      timestamp: '2024-01-01T00:00:00.000Z',
      custom_content: {
        stages: [
          {
            index: 0,
            name: 'step-1',
            status: StageStatus.Completed,
            content: '',
          },
        ],
      },
    };
    expect(messageHasStages(msg)).toBe(true);
  });
});

/*
 * ---------------------------------------------------------------------------
 * resolveToolStageLabels
 * ---------------------------------------------------------------------------
 */

describe('resolveToolStageLabels', () => {
  it('overwrites name/tag for a stage with a recognized toolKind', () => {
    const stages: Stage[] = [
      {
        index: 0,
        name: 'Web Search',
        status: null,
        tag: 'Web Search',
        toolKind: ToolStageKind.WebSearch,
      },
    ];
    const result = resolveToolStageLabels(stages, {
      [ToolStageKind.WebSearch]: 'Recherche Web',
    });
    expect(result[0].name).toBe('Recherche Web');
    expect(result[0].tag).toBe('Recherche Web');
  });

  it('leaves a stage without a recognized toolKind unchanged', () => {
    const stages: Stage[] = [
      { index: 0, name: 'Custom stage', status: null, tag: 'MCP' },
    ];
    const result = resolveToolStageLabels(stages, {
      [ToolStageKind.WebSearch]: 'Web Search',
    });
    expect(result[0]).toEqual(stages[0]);
  });
});

/*
 * ---------------------------------------------------------------------------
 * getReasoningSummaryText
 * ---------------------------------------------------------------------------
 */

describe('getReasoningSummaryText', () => {
  it('returns an empty string when parts is undefined', () => {
    expect(getReasoningSummaryText(undefined)).toBe('');
  });

  it('concatenates parts ordered by outputIndex then summaryIndex, not arrival order', () => {
    const text = getReasoningSummaryText([
      { itemId: 'rs_1', outputIndex: 1, summaryIndex: 0, text: 'Second' },
      { itemId: 'rs_1', outputIndex: 0, summaryIndex: 1, text: 'B' },
      { itemId: 'rs_1', outputIndex: 0, summaryIndex: 0, text: 'A' },
    ]);
    expect(text).toBe('ABSecond');
  });
});
