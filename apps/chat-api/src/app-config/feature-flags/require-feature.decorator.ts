import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from './feature-key.enum';

export const FEATURE_KEY_METADATA = 'feature_key';

export const RequireFeature = (key: FeatureKey) =>
  SetMetadata(FEATURE_KEY_METADATA, key);
