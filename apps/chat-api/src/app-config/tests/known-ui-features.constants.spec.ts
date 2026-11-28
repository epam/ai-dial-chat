import { describe, expect, it } from 'vitest';
import {
  DEPRECATED_UI_FEATURE_ALIASES,
  KNOWN_UI_FEATURES,
} from '../known-ui-features.constants';

/*
 * `KNOWN_UI_FEATURES` is hand-maintained so this Node-only service does not
 * import the browser-facing overlay package. It cannot be diffed against
 * `OverlayFeature` here: `@epam/ai-dial-chat-overlay` resolves to its built
 * `dist` from a Node test, so the comparison would pass or fail on whether the
 * lib happens to be built. These assertions pin the membership instead — update
 * them in the same change as any `OverlayFeature` addition, removal, or rename.
 */
describe('KNOWN_UI_FEATURES', () => {
  it('has exactly 57 members, one per OverlayFeature key', () => {
    expect(KNOWN_UI_FEATURES.size).toBe(58);
  });

  it.each([
    [
      'includes representative transferable keys',
      { keys: ['header', 'likes', 'voice-input'] },
    ],
    [
      'includes the chat-input keys',
      { keys: ['chat-settings', 'removable-tools', 'conversation-drafts'] },
    ],
    [
      'includes the catalog keys under their current names',
      { keys: ['catalog', 'catalog-hide-my-apps', 'catalog-table-view'] },
    ],
    [
      'includes the starter-layout key',
      {
        keys: ['show-all-starters', 'starters-below-greeting', 'hide-greeting'],
      },
    ],
  ])('%s', (_name, { keys: [first, second, third] }) => {
    expect(KNOWN_UI_FEATURES.has(first)).toBe(true);
    expect(KNOWN_UI_FEATURES.has(second)).toBe(true);
    expect(KNOWN_UI_FEATURES.has(third)).toBe(true);
  });

  it('includes the keys that gate a whole route', () => {
    expect(KNOWN_UI_FEATURES.has('file-manager')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('prompts')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('skills')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('custom-apps')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('schema-apps')).toBe(true);
  });

  it.each([
    ['includes the footer-version key', { key: 'hide-footer-version' }],
    ['includes the agent-description key', { key: 'show-agent-description' }],
    [
      'includes the input-history-navigation key',
      { key: 'disable-input-history-navigation' },
    ],
    [
      'includes the conversation-export key',
      { key: 'hide-conversation-export' },
    ],
    [
      'includes the conversation-import key',
      { key: 'hide-conversation-import' },
    ],
    ['includes the settings-page key', { key: 'hide-settings-page' }],
    ['includes the usage-page key', { key: 'hide-usage-page' }],
    ['includes the header-logo key', { key: 'show-header-logo' }],
    ['includes the starter-icon key', { key: 'hide-starter-icon' }],
    [
      'includes the mobile-header-full-logo key',
      { key: 'show-mobile-header-full-logo' },
    ],
  ])('%s', (_name, { key }) => {
    expect(KNOWN_UI_FEATURES.has(key)).toBe(true);
  });

  it('includes both agent-selector keys', () => {
    expect(KNOWN_UI_FEATURES.has('disallow-change-agent')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('hide-change-agent')).toBe(true);
  });

  it('rejects the legacy wire values that OverlayFeature renamed', () => {
    expect(KNOWN_UI_FEATURES.has('marketplace')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('marketplace-hide-my-apps')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('marketplace-table-view')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('custom-applications')).toBe(false);
  });

  it('rejects the legacy wire values whose behavior is now unconditional', () => {
    expect(KNOWN_UI_FEATURES.has('custom-logo')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('show-layout-dividers')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('top-settings')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('top-chat-model-settings')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('chat-header-border')).toBe(false);
    expect(KNOWN_UI_FEATURES.has('chat-input-border')).toBe(false);
  });

  it('does not include unrecognized values', () => {
    expect(KNOWN_UI_FEATURES.has('not-a-real-feature')).toBe(false);
  });
});

describe('DEPRECATED_UI_FEATURE_ALIASES', () => {
  it('maps every deprecated value onto a currently known one', () => {
    Object.entries(DEPRECATED_UI_FEATURE_ALIASES).forEach(
      ([deprecated, replacement]) => {
        expect(KNOWN_UI_FEATURES.has(deprecated)).toBe(false);
        expect(KNOWN_UI_FEATURES.has(replacement)).toBe(true);
      },
    );
  });

  it('maps custom-applications to schema-apps', () => {
    expect(DEPRECATED_UI_FEATURE_ALIASES['custom-applications']).toBe(
      'schema-apps',
    );
  });
});
