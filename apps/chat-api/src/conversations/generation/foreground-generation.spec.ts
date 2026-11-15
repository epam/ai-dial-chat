import { describe, expect, it } from 'vitest';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import {
  FOREGROUND_EXPIRY_GRACE_MS,
  FOREGROUND_REREAD_INTERVAL_MS,
  buildForegroundMarker,
  buildForegroundStopReleaseMs,
  findActiveGeneration,
  findForegroundMessageIndex,
  findLiveForegroundMessage,
  isLiveForegroundMarker,
  neutralizeForegroundMarkers,
} from './foreground-generation';

const NOW = 1_793_875_200_000;
const GEN = '4b2c8f1e-7d3a-4c5b-9e2f-0a1b2c3d4e5f';
const OTHER = '9d1e2f3a-4b5c-4d6e-8f70-81a2b3c4d5e6';

const user: ConversationMessageDto = {
  role: ConversationMessageRole.User,
  content: 'hi',
  timestamp: 't0',
};
const marked = (
  generationId: string,
  expiresAt: number,
  extra: Partial<ConversationMessageDto> = {},
): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: 't1',
  foregroundGeneration: { generationId, startedAt: NOW, expiresAt },
  ...extra,
});

describe('buildForegroundMarker', () => {
  it('expires after the max duration, the finalize timeout and the grace period', () => {
    expect(
      buildForegroundMarker({
        generationId: GEN,
        now: NOW,
        maxDurationMs: 1_800_000,
        finalizeTimeoutMs: 60_000,
      }),
    ).toEqual({
      generationId: GEN,
      startedAt: NOW,
      expiresAt: NOW + 1_800_000 + 60_000 + FOREGROUND_EXPIRY_GRACE_MS,
    });
  });
});

describe('buildForegroundStopReleaseMs', () => {
  it('covers two re-reads and the finalize timeout', () => {
    expect(buildForegroundStopReleaseMs(60_000)).toBe(
      2 * FOREGROUND_REREAD_INTERVAL_MS + 60_000,
    );
  });
});

describe('isLiveForegroundMarker', () => {
  const marker = { generationId: GEN, startedAt: NOW, expiresAt: NOW + 10 };

  it('is live before its expiry', () => {
    expect(isLiveForegroundMarker(marker, NOW + 9)).toBe(true);
  });

  it('is not live at or after its expiry', () => {
    expect(isLiveForegroundMarker(marker, NOW + 10)).toBe(false);
    expect(isLiveForegroundMarker(marker, NOW + 11)).toBe(false);
  });

  it('is not live when absent', () => {
    expect(isLiveForegroundMarker(undefined, NOW)).toBe(false);
  });
});

describe('findForegroundMessageIndex', () => {
  it('finds the message by generation id whether or not its marker is live', () => {
    const messages = [user, marked(GEN, NOW - 1)];
    expect(findForegroundMessageIndex(messages, GEN)).toBe(1);
    expect(findForegroundMessageIndex(messages, OTHER)).toBe(-1);
  });
});

describe('findLiveForegroundMessage', () => {
  it('returns the live marked message and its index', () => {
    const message = marked(GEN, NOW + 1);
    expect(
      findLiveForegroundMessage({ messages: [user, message] }, NOW),
    ).toEqual({ index: 1, message });
  });

  it('ignores an expired marker', () => {
    expect(
      findLiveForegroundMessage({ messages: [user, marked(GEN, NOW)] }, NOW),
    ).toBeNull();
  });
});

describe('findActiveGeneration', () => {
  it('finds a pending background message', () => {
    const pending: ConversationMessageDto = {
      role: ConversationMessageRole.Assistant,
      content: '',
      timestamp: 't1',
      backgroundGeneration: {
        generationId: GEN,
        status: BackgroundGenerationStatus.Pending,
        startedAt: NOW,
      },
    };
    expect(findActiveGeneration({ messages: [user, pending] }, NOW)).toEqual({
      index: 1,
      message: pending,
    });
  });

  it('finds a live foreground marker', () => {
    const message = marked(GEN, NOW + 1);
    expect(findActiveGeneration({ messages: [user, message] }, NOW)).toEqual({
      index: 1,
      message,
    });
  });

  it('finds nothing for an expired marker or a finished background message', () => {
    const finished: ConversationMessageDto = {
      role: ConversationMessageRole.Assistant,
      content: 'done',
      timestamp: 't2',
      backgroundGeneration: {
        generationId: OTHER,
        status: BackgroundGenerationStatus.Completed,
        startedAt: NOW,
      },
    };
    expect(
      findActiveGeneration(
        { messages: [user, finished, marked(GEN, NOW)] },
        NOW,
      ),
    ).toBeNull();
  });

  it('finds nothing in a missing conversation', () => {
    expect(findActiveGeneration(undefined, NOW)).toBeNull();
  });
});

describe('neutralizeForegroundMarkers', () => {
  it('removes a marker and marks a message without terminal markers interrupted', () => {
    const [result] = neutralizeForegroundMarkers([marked(GEN, NOW + 1)]);
    expect(result.foregroundGeneration).toBeUndefined();
    expect(result.streamErrorMessage).toBe('');
  });

  it('keeps an existing terminal marker unchanged', () => {
    const [errored, stopped] = neutralizeForegroundMarkers([
      marked(GEN, NOW + 1, { streamErrorMessage: 'Rate limit' }),
      marked(OTHER, NOW + 1, { wasStoppedByUser: true } as never),
    ]);
    expect(errored.streamErrorMessage).toBe('Rate limit');
    expect(stopped.streamErrorMessage).toBeUndefined();
    expect(stopped.foregroundGeneration).toBeUndefined();
  });

  it('keeps the marker of the generation it is told to keep', () => {
    const keep = marked(GEN, NOW + 1);
    const [kept, removed] = neutralizeForegroundMarkers(
      [keep, marked(OTHER, NOW + 1)],
      GEN,
    );
    expect(kept).toBe(keep);
    expect(removed.foregroundGeneration).toBeUndefined();
  });

  it('leaves unmarked messages untouched', () => {
    const [result] = neutralizeForegroundMarkers([user]);
    expect(result).toBe(user);
  });
});
