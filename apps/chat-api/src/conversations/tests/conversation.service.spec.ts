import { describe, expect, it, beforeEach } from 'vitest';
import { ConversationService } from '../conversation.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
  });

  describe('createConversation', () => {
    it('returns a conversation with a UUID-format id', () => {
      const result = service.createConversation('Hello');
      expect(result.id).toMatch(UUID_REGEX);
    });

    it('returns a conversation with an ISO-8601 createdAt', () => {
      const result = service.createConversation('Hello');
      expect(result.createdAt).toMatch(ISO_REGEX);
    });

    it('returns a conversation with one user message containing the firstMessage content', () => {
      const result = service.createConversation('Hello world');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello world');
    });

    it('gives the message a UUID-format id', () => {
      const result = service.createConversation('Hello');
      expect(result.messages[0].id).toMatch(UUID_REGEX);
    });

    it('gives the message an ISO-8601 timestamp', () => {
      const result = service.createConversation('Hello');
      expect(result.messages[0].timestamp).toMatch(ISO_REGEX);
    });

    it('generates a unique id for each conversation', () => {
      const a = service.createConversation('First');
      const b = service.createConversation('Second');
      expect(a.id).not.toBe(b.id);
    });
  });
});
