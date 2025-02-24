import { PageType } from '@/src/types/common';

export const getPageType = (route?: string) => {
  switch (route) {
    case '/marketplace':
      return PageType.Marketplace;
    case '/apps-editor/[slug]/settings':
      return PageType.AppsEditorSettings;
    case '/apps-editor/[slug]':
      return PageType.AppsEditorGeneralInfo;
    default:
      return PageType.Chat;
  }
};
