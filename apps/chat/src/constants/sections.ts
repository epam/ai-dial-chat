import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

export const ORGANIZATION_SECTION_NAME = translate(ChatI18nKeys.Organization, {
  ns: Translation.Chat,
});
export const APPROVE_REQUIRED_SECTION_NAME = translate(
  ChatI18nKeys.ApproveRequired,
  {
    ns: Translation.Chat,
  },
);
export const SHARED_WITH_ME_SECTION_NAME = translate(
  ChatI18nKeys.SharedWithMe,
  {
    ns: Translation.Chat,
  },
);
export const ROOT_SECTION_NAME = translate(ChatI18nKeys.AllFiles, {
  ns: Translation.Chat,
});

export const PINNED_PROMPTS_SECTION_NAME = translate(
  ChatI18nKeys.PinnedPrompts,
  {
    ns: Translation.Chat,
  },
);
export const RECENT_PROMPTS_SECTION_NAME = translate(ChatI18nKeys.Recent, {
  ns: Translation.Chat,
});

export const PINNED_CONVERSATIONS_SECTION_NAME = translate(
  ChatI18nKeys.PinnedConversations,
  {
    ns: Translation.Chat,
  },
);
export const CONVERSATIONS_DATE_SECTIONS = {
  today: translate(ChatI18nKeys.Today, { ns: Translation.Chat }),
  yesterday: translate(ChatI18nKeys.Yesterday, { ns: Translation.Chat }),
  lastSevenDays: translate(ChatI18nKeys.Last7Days, {
    ns: Translation.Chat,
  }),
  lastThirtyDays: translate(ChatI18nKeys.Last30Days, {
    ns: Translation.Chat,
  }),
  older: translate(ChatI18nKeys.Older, { ns: Translation.Chat }),
  other: translate(ChatI18nKeys.Other, { ns: Translation.Chat }),
};
