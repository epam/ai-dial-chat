import { OnboardingHintTarget } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import anchors from '../onboarding-anchors.json';
import { ONBOARDING_ANCHOR_TARGETS } from '../onboarding-targets';

describe('onboarding anchor catalog', () => {
  it('describes every target chat-api accepts, once each', () => {
    const catalogTargets = anchors.map((anchor) => anchor.target);
    expect(new Set(catalogTargets).size).toBe(catalogTargets.length);
    expect([...catalogTargets].sort()).toEqual(
      [...Object.values(OnboardingHintTarget)].sort(),
    );
  });

  it('describes exactly the targets the app can resolve', () => {
    expect([...anchors.map((anchor) => anchor.target)].sort()).toEqual(
      [...ONBOARDING_ANCHOR_TARGETS].sort(),
    );
  });

  it('fills every column of the catalog', () => {
    for (const anchor of anchors) {
      expect(anchor.page.trim()).not.toBe('');
      expect(anchor.element.trim()).not.toBe('');
      expect(anchor.lookup.trim()).not.toBe('');
    }
  });
});
