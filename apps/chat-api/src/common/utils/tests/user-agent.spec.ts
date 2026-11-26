import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION } from '../app-version';
import { buildChatUserAgent } from '../user-agent';

describe('buildChatUserAgent', () => {
  it('uses the configured version', () => {
    expect(buildChatUserAgent('2026.08.25-a1b2c3d')).toBe(
      'ai-dial-chat/2026.08.25-a1b2c3d',
    );
  });

  it.each([undefined, null, '', '   '])(
    'falls back to the build version for %j',
    (override) => {
      expect(buildChatUserAgent(override)).toBe(
        `ai-dial-chat/${PACKAGE_VERSION}`,
      );
    },
  );

  it('replaces unsupported characters and trims surrounding hyphens', () => {
    expect(buildChatUserAgent(' release 2026/08 ')).toBe(
      'ai-dial-chat/release-2026-08',
    );
  });

  it('answers unknown when no supported character remains', () => {
    expect(buildChatUserAgent('/// ***')).toBe('ai-dial-chat/unknown');
  });
});
