import { PageType } from '@/src/types/common';

export const getPageType = (route?: string) => {
  switch (route) {
    case '/marketplace':
      return PageType.Marketplace;
    default:
      return PageType.Chat;
  }
};
