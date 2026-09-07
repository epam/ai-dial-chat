import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConversationGenerationService,
  GenerationStatus,
} from '../conversation-generation.service';
import {
  ConversationMessageDto,
  ConversationMessageRole,
} from '../dto/conversation-message.dto';

const SESSION = 'session-1';
const PATH = 'gpt-4o__Test Chat';
const GENERATION_ID = 'gen-1';

const makeMessage = (content: string): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content,
  timestamp: '2026-01-01T00:00:00.000Z',
});

describe('ConversationGenerationService', () => {
  let service: ConversationGenerationService;

  beforeEach(() => {
    service = new ConversationGenerationService();
  });

  describe('register', () => {
    it('returns an AbortController for a new generation', () => {
      const controller = service.register(SESSION, PATH, GENERATION_ID);
      expect(controller).toBeInstanceOf(AbortController);
      expect(service.getStatus(SESSION, PATH)).toBe(GenerationStatus.Active);
    });

    it('throws ConflictException when a generation is already active for the same session+path', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      expect(() => service.register(SESSION, PATH, 'gen-2')).toThrow(
        ConflictException,
      );
    });

    it('seeds an empty placeholder assembled message so an immediate attach is safe', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH);
      expect(attachment?.assembledMessage.content).toBe('');
      expect(attachment?.assembledMessage.role).toBe(
        ConversationMessageRole.Assistant,
      );
    });
  });

  describe('attach', () => {
    it('returns undefined when no generation is active for the path', () => {
      expect(service.attach(SESSION, PATH)).toBeUndefined();
    });

    it('returns undefined after the generation has already finished', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.complete(SESSION, PATH, GENERATION_ID);
      expect(service.attach(SESSION, PATH)).toBeUndefined();
    });
  });

  describe('seedAssembledMessage / applyChunk', () => {
    it('applyChunk updates the retained snapshot and emits the raw chunk to attached listeners', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.seedAssembledMessage(
        SESSION,
        PATH,
        GENERATION_ID,
        makeMessage(''),
      );

      const attachment = service.attach(SESSION, PATH)!;
      const onChunk = vi.fn();
      attachment.emitter.on('chunk', onChunk);

      const rawChunk = { choices: [{ delta: { content: 'Hi' } }] };
      service.applyChunk(
        SESSION,
        PATH,
        GENERATION_ID,
        rawChunk,
        makeMessage('Hi'),
      );

      expect(onChunk).toHaveBeenCalledExactlyOnceWith(rawChunk);
      expect(service.attach(SESSION, PATH)?.assembledMessage.content).toBe(
        'Hi',
      );
    });

    it('ignores applyChunk for a stale generationId', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      service.applyChunk(
        SESSION,
        PATH,
        'stale-gen',
        {},
        makeMessage('ignored'),
      );
      expect(service.attach(SESSION, PATH)?.assembledMessage.content).toBe('');
    });
  });

  describe('complete', () => {
    it('emits a done terminal event, clears listeners, and removes the registry entry', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.complete(SESSION, PATH, GENERATION_ID);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'done' });
      expect(attachment.emitter.listenerCount('terminal')).toBe(0);
      expect(service.getStatus(SESSION, PATH)).toBeUndefined();
    });
  });

  describe('error', () => {
    it('emits an error terminal event carrying the message when the generation was not stopped', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      service.error(SESSION, PATH, GENERATION_ID, 'boom');

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({
        type: 'error',
        message: 'boom',
      });
    });

    it('emits a stopped terminal event when abort() marked the entry Stopped first', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      const attachment = service.attach(SESSION, PATH)!;
      const onTerminal = vi.fn();
      attachment.emitter.on('terminal', onTerminal);

      expect(service.abort(SESSION, PATH, GENERATION_ID)).toBe(true);
      service.error(SESSION, PATH, GENERATION_ID);

      expect(onTerminal).toHaveBeenCalledExactlyOnceWith({ type: 'stopped' });
    });
  });

  describe('abort', () => {
    it('returns false when no matching active generation exists', () => {
      expect(service.abort(SESSION, PATH, GENERATION_ID)).toBe(false);
    });

    it('returns false for a generationId that does not match the active one', () => {
      service.register(SESSION, PATH, GENERATION_ID);
      expect(service.abort(SESSION, PATH, 'other-gen')).toBe(false);
    });
  });

  describe('many concurrent attach subscribers', () => {
    it('supports more than the default max-listener count without warning', () => {
      const onWarning = vi.fn();
      process.on('warning', onWarning);
      try {
        service.register(SESSION, PATH, GENERATION_ID);
        const attachment = service.attach(SESSION, PATH)!;
        for (let i = 0; i < 20; i += 1) {
          attachment.emitter.on('chunk', vi.fn());
        }
        service.applyChunk(SESSION, PATH, GENERATION_ID, {}, makeMessage(''));
        expect(onWarning).not.toHaveBeenCalled();
      } finally {
        process.off('warning', onWarning);
      }
    });
  });
});
