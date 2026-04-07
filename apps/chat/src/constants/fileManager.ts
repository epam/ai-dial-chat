import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

export const MY_FILES_SECTION = translate(ChatI18nKeys.MyFiles, {
  ns: Translation.Chat,
});
export const SHARED_WITH_ME_FILES_SECTION = translate(
  ChatI18nKeys.SharedWithMeFiles,
  {
    ns: Translation.Chat,
  },
);
export const ORGANIZATION_FILES_SECTION = translate(ChatI18nKeys.Organization, {
  ns: Translation.Chat,
});

export const REVIEW_FILES_SECTION = translate('Review files');
