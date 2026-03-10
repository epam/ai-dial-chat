import { PublicationFunctions } from '@/src/types/publication';

const filterLabelMap: Record<string, string> = {
  [PublicationFunctions.Contain]: 'Contains',
  [PublicationFunctions.Equal]: 'Equals',
  [PublicationFunctions.Regex]: 'Regex ',
};

export const getFilterLabel = (filterType: string) => {
  return filterLabelMap[filterType] || filterType;
};
