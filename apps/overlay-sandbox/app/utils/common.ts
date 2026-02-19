import { ChatOverlayOptions, Feature } from '@epam/ai-dial-shared';

export const parseJsonOptionsString = (jsonString: string) => {
  try {
    return JSON.parse(jsonString) as ChatOverlayOptions;
  } catch (error) {
    console.error('Invalid JSON string:', error);
    return null;
  }
};

const parseCommaSeparatedList = (
  str: string | undefined,
  defaultValue: string[] = [],
): string[] => str?.split(',').map((str) => str.trim()) ?? defaultValue;

export const getEnabledFeatures = (
  enabledFeatures: Feature[] | string | undefined,
) => {
  if (!enabledFeatures) return [];

  if (typeof enabledFeatures === 'string') {
    return parseCommaSeparatedList(enabledFeatures);
  }

  if (Array.isArray(enabledFeatures)) {
    return enabledFeatures;
  }
  return [];
};
