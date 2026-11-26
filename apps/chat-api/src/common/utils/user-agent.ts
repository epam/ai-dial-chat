import { resolveAppVersion } from './app-version';
import { StringUtils } from './string-utils';

const USER_AGENT_PRODUCT = 'ai-dial-chat';
const UNSUPPORTED_USER_AGENT_VERSION_CHARACTERS = /[^A-Za-z0-9._-]+/g;

const normalizeUserAgentVersion = (version: string): string => {
  /*
   * Hyphens are allowed characters, so a version may legitimately carry a run
   * of them at either end — they are trimmed by index scan rather than a
   * `/^-+|-+$/` regex, whose `-+$` alternative has an unanchored start and so
   * costs quadratic time on a mostly-hyphen version (CodeQL
   * js/polynomial-redos).
   */
  const normalized = StringUtils.stripSurroundingChar(
    version.replace(UNSUPPORTED_USER_AGENT_VERSION_CHARACTERS, '-'),
    '-',
  );

  return normalized || 'unknown';
};

/**
 * Returns the Chat product User-Agent, `ai-dial-chat/<normalized-version>`,
 * sent to DIAL Core and DIAL Analytics.
 * @param override - the configured `CHAT_VERSION`; a missing or blank value falls back to the build version
 */
export const buildChatUserAgent = (override?: string | null): string =>
  `${USER_AGENT_PRODUCT}/${normalizeUserAgentVersion(resolveAppVersion(override))}`;
