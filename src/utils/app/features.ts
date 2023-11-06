import { availableFeatures } from '@/src/types/features';

export const validateFeature = (feature: string) => {
  return feature in availableFeatures;
};
