import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { translateResponseFormatValue } from '@/src/components/Chat/ChatSettings/translateResponseFormatLabel';

import { ConversationResponseFormat } from '@epam/ai-dial-shared';

interface Props {
  systemPrompt: string;
  temperature: number | null;
  disallowChangeSettings: boolean;
  responseFormat?: ConversationResponseFormat;
  hasSettings: boolean;
}

const SM_HEIGHT_THRESHOLDS = [
  { threshold: 480, class: 'line-clamp-3' },
  { threshold: 640, class: 'line-clamp-6' },
  { threshold: 800, class: 'line-clamp-[14]' },
  { threshold: 960, class: 'line-clamp-[20]' },
];
const DEFAULT_SM_LINE_CLAMP = 'line-clamp-[28]';

export const HeaderSettingsTooltip = ({
  systemPrompt,
  temperature,
  disallowChangeSettings,
  hasSettings,
  responseFormat,
}: Props) => {
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const responseFormatLabel = useMemo(() => {
    if (!responseFormat) {
      return undefined;
    }

    return translateResponseFormatValue(responseFormat, router.locale, t);
  }, [responseFormat, router.locale, t]);

  const lineClampClass =
    SM_HEIGHT_THRESHOLDS.find(
      (lineClamp) => window.innerHeight <= lineClamp.threshold,
    )?.class || DEFAULT_SM_LINE_CLAMP;

  return (
    <div
      className="grid max-w-[880px] grid-cols-1 p-2"
      data-qa="chat-settings-tooltip"
    >
      <div className="font-semibold">
        {t(
          disallowChangeSettings || !hasSettings
            ? ChatI18nKeys.ConversationSettings
            : ChatI18nKeys.ChangeConversationSettings,
        )}
        :
      </div>
      <div className="mt-3 grid max-w-full grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        {!systemPrompt && temperature === null && !responseFormat && (
          <span className="text-secondary">
            {t(ChatI18nKeys.NoConversationSettings)}
          </span>
        )}
        {systemPrompt && (
          <>
            <span className="text-secondary">
              {t(ChatI18nKeys.SystemPrompt)}:
            </span>
            <div
              className={classNames('whitespace-pre-wrap', lineClampClass)}
              data-qa="prompt-info"
            >
              {systemPrompt}
            </div>
          </>
        )}
        {temperature !== null && (
          <>
            <span className="text-secondary">
              {t(ChatI18nKeys.Temperature)}:
            </span>
            <div data-qa="temp-info">{temperature}</div>
          </>
        )}

        {responseFormatLabel && (
          <>
            <span className="text-secondary">
              {t(ChatI18nKeys.ResponseFormat)}:
            </span>
            <div data-qa="response-format">{responseFormatLabel}</div>
          </>
        )}
      </div>
    </div>
  );
};
