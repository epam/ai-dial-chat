import { describe, expect, it } from 'vitest';
import { KNOWN_UI_FEATURES } from '../known-ui-features.constants';

describe('KNOWN_UI_FEATURES', () => {
  it('has exactly 38 members, matching OverlayFeature', () => {
    expect(KNOWN_UI_FEATURES.size).toBe(38);
  });

  it('includes representative transferable keys', () => {
    expect(KNOWN_UI_FEATURES.has('header')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('likes')).toBe(true);
    expect(KNOWN_UI_FEATURES.has('voice-input')).toBe(true);
  });

  it('does not include unrecognized values', () => {
    expect(KNOWN_UI_FEATURES.has('not-a-real-feature')).toBe(false);
  });
});
