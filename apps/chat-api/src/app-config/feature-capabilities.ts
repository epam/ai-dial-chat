import { FeatureKey } from './feature-flags/feature-key.enum';

/**
 * The local values a capability-derived feature depends on. The ENV provider
 * reads them from `ConfigService`; a future source must not supply them.
 */
export interface CapabilityInputs {
  /** `ASR_MODEL`: the transcription model deployment. */
  readonly asrModel?: string;
  /** `UTILITY_MODEL`: the server-side utility model deployment. */
  readonly utilityModel?: string;
  /** `DIAL_API_KEY`: the credential server-side utility calls use. */
  readonly dialApiKey?: string;
  /** `LLM_CONVERSATION_NAMING_ENABLED`: the operator opt-in. */
  readonly llmConversationNamingEnabled?: boolean;
  /** `FOOTER_HTML_MESSAGE`: the footer copy. */
  readonly footerHtmlMessage?: string;
}

/** The features whose value is derived from a local capability. */
export const CAPABILITY_FEATURE_KEYS: readonly FeatureKey[] = [
  FeatureKey.AsrEnabled,
  FeatureKey.LlmConversationNaming,
  FeatureKey.Footer,
];

/**
 * Whether the local capability behind `key` exists. A feature without a
 * capability rule is always available. A future source is composed with this
 * check by `AND`; it can never switch on a feature whose capability is absent.
 */
export const isCapabilityAvailable = (
  key: string,
  inputs: CapabilityInputs,
): boolean => {
  switch (key) {
    case FeatureKey.AsrEnabled:
      return inputs.asrModel != null;
    case FeatureKey.LlmConversationNaming:
      return Boolean(inputs.utilityModel) && Boolean(inputs.dialApiKey);
    case FeatureKey.Footer:
      return inputs.footerHtmlMessage != null;
    default:
      return true;
  }
};

/**
 * The value the environment derives for a capability feature: `undefined`
 * when the capability is absent (so the registry default, `false`, applies),
 * otherwise `true`, or the opt-in for conversation naming. Returns
 * `undefined` for a key that is not a capability feature.
 */
export const deriveCapabilityFeature = (
  key: string,
  inputs: CapabilityInputs,
): boolean | undefined => {
  if (
    !CAPABILITY_FEATURE_KEYS.some((featureKey) => featureKey === key) ||
    !isCapabilityAvailable(key, inputs)
  ) {
    return undefined;
  }
  if (key === FeatureKey.LlmConversationNaming) {
    return inputs.llmConversationNamingEnabled === true;
  }
  return true;
};
