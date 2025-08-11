import { Feature, FeatureData } from '../types/features';

export const validateFeature = (feature: Feature | FeatureData) => {
  const featureName = typeof feature === 'string' ? feature : feature.name;
  return Object.values(Feature).includes(featureName);
};
