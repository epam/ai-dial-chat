import { ApiEndpoints } from '../server-api/base';

export const getIconPath = (iconName?: string): string => {
  return `${ApiEndpoints.THEME_ICON}?iconName=${encodeURIComponent(iconName || '')}`;
};
