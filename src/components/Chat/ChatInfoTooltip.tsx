import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { ConversationEntityModel } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

interface Props {
  model: OpenAIEntityModel | ConversationEntityModel;
  selectedAddons: OpenAIEntityAddon[] | null;
  prompt: string | null;
  temperature: number | null;
  subModel?: OpenAIEntityModel | null;
}

const SM_HEIGHT_THRESHOLDS = [
  { threshold: 480, class: 'line-clamp-3' },
  { threshold: 640, class: 'line-clamp-6' },
  { threshold: 800, class: 'line-clamp-[14]' },
  { threshold: 960, class: 'line-clamp-[20]' },
];
const DEFAULT_SM_LINE_CLAMP = 'line-clamp-[28]';

const getModelTemplate = (
  model: OpenAIEntityModel | ConversationEntityModel,
  label: string,
) => {
  return (
    <>
      <span className="text-secondary">{label}:</span>
      <div
        className="flex items-center gap-2"
        data-qa={label.toLowerCase().concat('-info')}
      >
        <ModelIcon
          entityId={model.id}
          entity={'type' in model ? model : undefined}
          size={18}
        />
        {'name' in model ? model.name : model.id}
      </div>
    </>
  );
};

export const ChatInfoTooltip = ({
  model,
  subModel,
  selectedAddons,
  prompt,
  temperature,
}: Props) => {
  const lineClampClass =
    SM_HEIGHT_THRESHOLDS.find(
      (lineClamp) => window.innerHeight <= lineClamp.threshold,
    )?.class || DEFAULT_SM_LINE_CLAMP;

  const { t } = useTranslation(Translation.Chat);
  const getModelLabel = useCallback(
    (type?: string) => {
      switch (type) {
        case EntityType.Application:
          return t('Application');
        case EntityType.Assistant:
          return t('Assistant');
        default:
          return t('Model');
      }
    },
    [t],
  );

  return (
    <div
      className="grid max-w-[880px] grid-cols-[max-content_1fr] gap-4 px-2 py-3"
      data-qa="chat-info-tooltip"
    >
      {model &&
        getModelTemplate(
          model,
          getModelLabel('type' in model ? model.type : undefined),
        )}
      {subModel != null && getModelTemplate(subModel, t('Assistant model'))}
      {prompt && (
        <>
          <span className="text-secondary">{t('System prompt')}:</span>
          <div
            className={`whitespace-pre-wrap ${lineClampClass}`}
            data-qa="prompt-info"
          >
            {prompt}
          </div>
        </>
      )}
      {temperature !== null && (
        <>
          <span className="text-secondary">{t('Temperature')}:</span>
          <div data-qa="temp-info">{temperature}</div>
        </>
      )}
      {selectedAddons !== null && selectedAddons?.length > 0 && (
        <>
          <span className="text-secondary">{t('Addons')}:</span>
          <div className="flex flex-wrap gap-1">
            {selectedAddons.map((addon) => (
              <span
                key={addon.id}
                className="flex gap-2 rounded bg-accent-primary-alpha px-3 py-2"
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
  );
};
