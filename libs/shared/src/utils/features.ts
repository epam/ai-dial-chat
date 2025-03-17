import { Feature } from '../types/features';

export const validateFeature = (feature: string) => {
  return Object.values(Feature).includes(feature as Feature);
};
