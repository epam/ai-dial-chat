import { describe, expect, it } from 'vitest';
import { getConversationName } from '../get-conversation-name';
import { prepareEntityName } from '../prepare-entity-name';

describe('conversation naming helpers', () => {
  describe('prepareEntityName', () => {
    it('should return empty string when prompt is undefined', () => {
      const result = prepareEntityName(undefined);
      expect(result).toBe('');
    });

    it('should return empty string when prompt is empty', () => {
      const result = prepareEntityName('');
      expect(result).toBe('');
    });

    it('should return the first line of a multiline prompt', () => {
      const result = prepareEntityName('First line\nSecond line');
      expect(result).toBe('First line');
    });

    it('should handle Windows line endings (\\r\\n)', () => {
      const result = prepareEntityName('First line\r\nSecond line');
      expect(result).toBe('First line');
    });

    it('should handle Mac line endings (\\r)', () => {
      const result = prepareEntityName('First line\rSecond line');
      expect(result).toBe('First line');
    });

    it('should trim whitespace', () => {
      const result = prepareEntityName('  Hello world  ');
      expect(result).toBe('Hello world');
    });

    it('should truncate to MAX_ENTITY_LENGTH (200 chars)', () => {
      const longString = 'a'.repeat(250);
      const result = prepareEntityName(longString);
      expect(result).toHaveLength(200);
      expect(result).toBe('a'.repeat(200));
    });

    it('should filter out empty lines and use first non-empty line', () => {
      const result = prepareEntityName('\n\nHello world\nAnother line');
      expect(result).toBe('Hello world');
    });
  });

  describe('getConversationName', () => {
    it('should use prompt if provided', () => {
      const result = getConversationName('Default Name', 'Custom prompt');
      expect(result).toBe('Custom prompt');
    });

    it('should use defaultName if prompt is not provided', () => {
      const result = getConversationName('Default Name');
      expect(result).toBe('Default Name');
    });

    it('should apply name cleaning to defaultName when prompt is not provided', () => {
      const result = getConversationName('Default :Name;');
      expect(result).toBe('Default  Name');
    });

    it('should apply name cleaning to prompt when provided', () => {
      const result = getConversationName(
        'Default Name',
        'Custom :prompt; with "special" chars',
      );
      expect(result).toBe('Custom  prompt  with  special  chars');
    });
  });
});
