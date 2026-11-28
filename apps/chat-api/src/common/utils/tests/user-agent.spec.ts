import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION } from '../app-version';
import { buildChatUserAgent } from '../user-agent';

describe('buildChatUserAgent', () => {
  it.each([
    [
      'uses the configured version',
      {
        version: '2026.08.25-a1b2c3d',
        expected: 'ai-dial-chat/2026.08.25-a1b2c3d',
      },
    ],
    [
      'replaces unsupported characters and trims surrounding hyphens',
      {
        version: ' release 2026/08 ',
        expected: 'ai-dial-chat/release-2026-08',
      },
    ],
    [
      'answers unknown when no supported character remains',
      { version: '/// ***', expected: 'ai-dial-chat/unknown' },
    ],
  ])('%s', (_name, { version, expected }) => {
    expect(buildChatUserAgent(version)).toBe(expected);
  });

  it.each([undefined, null, '', '   '])(
    'falls back to the build version for %j',
    (override) => {
      expect(buildChatUserAgent(override)).toBe(
        `ai-dial-chat/${PACKAGE_VERSION}`,
      );
    },
  );
});
