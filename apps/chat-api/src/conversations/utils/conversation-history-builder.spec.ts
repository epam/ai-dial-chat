import { BadRequestException } from '@nestjs/common';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ConversationMessageRole } from '../dto/conversation-message.dto';
import { CompletionMode } from '../dto/send-completion.dto';
import { buildConversationHistory } from './conversation-history-builder';

const makeConversation = (
  messages: { role: ConversationMessageRole; content: string }[] = [],
): ConversationResponseDto =>
  ({
    id: 'bucket/gpt-4o__test__uuid',
    folderId: 'bucket',
    name: 'test',
    model: { id: 'gpt-4o' },
    prompt: '',
    temperature: 1,
    messages: messages.map((m, i) => ({
      id: `msg-${i}`,
      role: m.role,
      content: m.content,
      timestamp: '2026-01-01T00:00:00.000Z',
    })),
    lastActivityDate: 0,
    updatedAt: 0,
    selectedAddons: [],
    assistantModelId: 'gpt-4o',
  }) as ConversationResponseDto;

describe('buildConversationHistory', () => {
  describe('Append mode', () => {
    it('appends user message + assistant placeholder', () => {
      const conv = makeConversation([]);
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.Append,
        conv,
        'Hello',
        undefined,
        undefined,
      );
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].role).toBe(ConversationMessageRole.User);
      expect(conversation.messages[0].content).toBe('Hello');
      expect(conversation.messages[1].role).toBe(
        ConversationMessageRole.Assistant,
      );
      expect(conversation.messages[1].content).toBe('');
      expect(assistantMessageIndex).toBe(1);
    });

    it('appends after existing messages', () => {
      const conv = makeConversation([
        { role: ConversationMessageRole.User, content: 'prev' },
        { role: ConversationMessageRole.Assistant, content: 'ans' },
      ]);
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.Append,
        conv,
        'new',
        undefined,
        undefined,
      );
      expect(conversation.messages).toHaveLength(4);
      expect(assistantMessageIndex).toBe(3);
    });
  });

  describe('ContinueLastUser mode', () => {
    it('only appends assistant placeholder when last message is user', () => {
      const conv = makeConversation([
        { role: ConversationMessageRole.User, content: 'question' },
      ]);
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.ContinueLastUser,
        conv,
        undefined,
        undefined,
        undefined,
      );
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].content).toBe('question');
      expect(conversation.messages[1].role).toBe(
        ConversationMessageRole.Assistant,
      );
      expect(assistantMessageIndex).toBe(1);
    });

    it('appends user message + assistant when last message is not user', () => {
      const conv = makeConversation([
        { role: ConversationMessageRole.User, content: 'prev' },
        { role: ConversationMessageRole.Assistant, content: 'ans' },
      ]);
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.ContinueLastUser,
        conv,
        'new question',
        undefined,
        undefined,
      );
      expect(conversation.messages).toHaveLength(4);
      expect(conversation.messages[2].role).toBe(ConversationMessageRole.User);
      expect(conversation.messages[3].role).toBe(
        ConversationMessageRole.Assistant,
      );
      expect(assistantMessageIndex).toBe(3);
    });
  });

  describe('Regenerate mode', () => {
    it('truncates at messageIndex and appends assistant placeholder', () => {
      const conv = makeConversation([
        { role: ConversationMessageRole.User, content: 'q' },
        { role: ConversationMessageRole.Assistant, content: 'old answer' },
      ]);
      // Regenerate the assistant at index 1 — keep user at index 0
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.Regenerate,
        conv,
        undefined,
        1,
        undefined,
      );
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].content).toBe('q');
      expect(conversation.messages[1].role).toBe(
        ConversationMessageRole.Assistant,
      );
      expect(conversation.messages[1].content).toBe('');
      expect(assistantMessageIndex).toBe(1);
    });

    it('throws BadRequestException when messageIndex is missing', () => {
      const conv = makeConversation([]);
      expect(() =>
        buildConversationHistory(
          CompletionMode.Regenerate,
          conv,
          undefined,
          undefined,
          undefined,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('Edit mode', () => {
    it('truncates at messageIndex, appends new user + assistant', () => {
      const conv = makeConversation([
        { role: ConversationMessageRole.User, content: 'old question' },
        { role: ConversationMessageRole.Assistant, content: 'old answer' },
      ]);
      // Edit user message at index 0
      const { conversation, assistantMessageIndex } = buildConversationHistory(
        CompletionMode.Edit,
        conv,
        'new question',
        0,
        undefined,
      );
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].role).toBe(ConversationMessageRole.User);
      expect(conversation.messages[0].content).toBe('new question');
      expect(conversation.messages[1].role).toBe(
        ConversationMessageRole.Assistant,
      );
      expect(assistantMessageIndex).toBe(1);
    });

    it('throws BadRequestException when messageIndex is missing', () => {
      const conv = makeConversation([]);
      expect(() =>
        buildConversationHistory(
          CompletionMode.Edit,
          conv,
          'q',
          undefined,
          undefined,
        ),
      ).toThrow(BadRequestException);
    });
  });

  it('throws BadRequestException for unknown mode', () => {
    const conv = makeConversation([]);
    expect(() =>
      buildConversationHistory(
        'unknown' as CompletionMode,
        conv,
        'q',
        undefined,
        undefined,
      ),
    ).toThrow(BadRequestException);
  });
});
