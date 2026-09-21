import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from './feature-key.enum';

export const FEATURE_KEY_METADATA = 'feature_key';

/** Allows a handler when the feature or any listed alternative is enabled. */
export const RequireFeature = (
  key: FeatureKey,
  ...alternatives: FeatureKey[]
) =>
  SetMetadata(
    FEATURE_KEY_METADATA,
    alternatives.length ? [key, ...alternatives] : key,
  );
