import { MessageRole, type Message } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMessageActions } from '../utils/build-message-actions';

const { copyToClipboardMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, copyToClipboard: copyToClipboardMock };
});

const userMessage = (content: string): Message => ({
  role: MessageRole.User,
  content,
  timestamp: '',
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('buildMessageActions — user message', () => {
  it('provides Copy even when no edit or delete handler is available', () => {
    const actions = buildMessageActions(userMessage('Hi'), 0, {});
    expect(actions.onCopy).toBeDefined();
    expect(actions.onEdit).toBeUndefined();
    expect(actions.onDelete).toBeUndefined();
  });

  it('copies a single-line prompt exactly', () => {
    buildMessageActions(userMessage('Summarize this file'), 0, {}).onCopy?.();
    expect(copyToClipboardMock).toHaveBeenCalledWith('Summarize this file');
  });

  it('copies a multiline prompt with its line breaks', () => {
    buildMessageActions(userMessage('a\n\n- b'), 0, {}).onCopy?.();
    expect(copyToClipboardMock).toHaveBeenCalledWith('a\n\n- b');
  });

  it('does not trigger edit, delete, or regenerate when copying', () => {
    const handlers = {
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onRegenerate: vi.fn(),
    };
    buildMessageActions(userMessage('Hi'), 2, handlers).onCopy?.();
    expect(handlers.onEdit).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
    expect(handlers.onRegenerate).not.toHaveBeenCalled();
  });
});

describe('buildMessageActions — status message', () => {
  it('returns no actions', () => {
    expect(
      buildMessageActions(
        { role: MessageRole.Status, content: '', timestamp: '' },
        0,
        {},
      ),
    ).toEqual({});
  });
});
