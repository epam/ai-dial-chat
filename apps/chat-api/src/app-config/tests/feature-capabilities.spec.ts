import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_FEATURE_KEYS,
  deriveCapabilityFeature,
  isCapabilityAvailable,
} from '../feature-capabilities';
import { FeatureKey } from '../feature-flags/feature-key.enum';

describe('feature capabilities', () => {
  it('covers exactly the three derived features', () => {
    expect([...CAPABILITY_FEATURE_KEYS].sort()).toEqual(
      [
        FeatureKey.AsrEnabled,
        FeatureKey.Footer,
        FeatureKey.LlmConversationNaming,
      ].sort(),
    );
  });

  describe('ASR', () => {
    it.each([
      [{}, false, undefined],
      [{ asrModel: 'whisper-1' }, true, true],
      /* An empty ASR_MODEL is present, so the capability exists. */
      [{ asrModel: '' }, true, true],
    ])('%j → available %s, derived %s', (inputs, available, derived) => {
      expect(isCapabilityAvailable(FeatureKey.AsrEnabled, inputs)).toBe(
        available,
      );
      expect(deriveCapabilityFeature(FeatureKey.AsrEnabled, inputs)).toBe(
        derived,
      );
    });
  });

  describe('LLM conversation naming', () => {
    it.each([
      [{}, false, undefined],
      [{ llmConversationNamingEnabled: true }, false, undefined],
      [{ utilityModel: 'm', dialApiKey: 'k' }, true, false],
      [
        {
          utilityModel: 'm',
          dialApiKey: 'k',
          llmConversationNamingEnabled: true,
        },
        true,
        true,
      ],
      [
        {
          utilityModel: 'm',
          dialApiKey: 'k',
          llmConversationNamingEnabled: false,
        },
        true,
        false,
      ],
      [
        { dialApiKey: 'k', llmConversationNamingEnabled: true },
        false,
        undefined,
      ],
      [
        { utilityModel: 'm', llmConversationNamingEnabled: true },
        false,
        undefined,
      ],
      [
        {
          utilityModel: '',
          dialApiKey: 'k',
          llmConversationNamingEnabled: true,
        },
        false,
        undefined,
      ],
    ])('%j → available %s, derived %s', (inputs, available, derived) => {
      expect(
        isCapabilityAvailable(FeatureKey.LlmConversationNaming, inputs),
      ).toBe(available);
      expect(
        deriveCapabilityFeature(FeatureKey.LlmConversationNaming, inputs),
      ).toBe(derived);
    });
  });

  describe('footer', () => {
    it.each([
      [{}, false, undefined],
      [{ footerHtmlMessage: 'Footer' }, true, true],
      [{ footerHtmlMessage: '' }, true, true],
    ])('%j → available %s, derived %s', (inputs, available, derived) => {
      expect(isCapabilityAvailable(FeatureKey.Footer, inputs)).toBe(available);
      expect(deriveCapabilityFeature(FeatureKey.Footer, inputs)).toBe(derived);
    });
  });

  it('treats a feature without a capability rule as available but not derived', () => {
    expect(isCapabilityAvailable(FeatureKey.ProjectsEnabled, {})).toBe(true);
    expect(
      deriveCapabilityFeature(FeatureKey.ProjectsEnabled, { asrModel: 'x' }),
    ).toBeUndefined();
  });
});
