import { availableFeatures } from '../types/features';

export const validateFeature = (feature: string) => {
  return feature in availableFeatures;
};
