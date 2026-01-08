import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface Props {
  systemPrompt: string;
  temperature: number | null;
  disallowChangeSettings: boolean;
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
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

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
            ? 'Conversation settings'
            : 'Change conversation settings',
        )}
        :
      </div>
      <div className="mt-3 grid max-w-full grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        {!systemPrompt && temperature === null && (
          <span className="text-secondary">
            {t('There are no conversation settings for this agent ')}
          </span>
        )}
        {systemPrompt && (
          <>
            <span className="text-secondary">{t('System prompt')}:</span>
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
            <span className="text-secondary">{t('Temperature')}:</span>
            <div data-qa="temp-info">{temperature}</div>
          </>
        )}
      </div>
    </div>
  );
};
