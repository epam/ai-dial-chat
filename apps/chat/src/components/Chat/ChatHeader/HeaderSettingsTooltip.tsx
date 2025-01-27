import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { DialAIEntityAddon, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../../Chatbar/ModelIcon';

interface Props {
  subModel: DialAIEntityModel | undefined;
  systemPrompt: string;
  temperature: number | null;
  selectedAddons: DialAIEntityAddon[] | null;
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
  subModel,
  systemPrompt,
  temperature,
  selectedAddons,
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
        {!subModel &&
          !systemPrompt &&
          temperature === null &&
          !selectedAddons?.length && (
            <span className="text-secondary">
              {t('There are no conversation settings for this agent ')}
            </span>
          )}
        {subModel && (
          <>
            <span className="text-secondary">{t('Assistant model')}:</span>
            <div data-qa="assistant-info">
              {getOpenAIEntityFullName(subModel)}
            </div>
          </>
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
        {!!selectedAddons?.length && (
          <>
            <span className="text-secondary">{t('Addons')}:</span>
            <div className="flex max-w-full flex-wrap gap-1">
              {selectedAddons.map((addon) => (
                <span
                  key={addon.id}
                  className="flex gap-2 whitespace-pre-wrap rounded bg-accent-primary-alpha px-3 py-2"
                  data-qa="addons-info"
                >
                  <ModelIcon entityId={addon.id} entity={addon} size={18} />
                  {addon.name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
