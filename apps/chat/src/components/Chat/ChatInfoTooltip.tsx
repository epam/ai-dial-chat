import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityAddon, DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/ModelIcon';

import { ConversationEntityModel } from '@epam/ai-dial-shared';

interface Props {
  model: DialAIEntityModel | ConversationEntityModel;
  selectedAddons: DialAIEntityAddon[] | null;
  prompt: string | null;
  temperature: number | null;
  subModel?: DialAIEntityModel | null;
}

const SM_HEIGHT_THRESHOLDS = [
  { threshold: 480, class: 'line-clamp-3' },
  { threshold: 640, class: 'line-clamp-6' },
  { threshold: 800, class: 'line-clamp-[14]' },
  { threshold: 960, class: 'line-clamp-[20]' },
];
const DEFAULT_SM_LINE_CLAMP = 'line-clamp-[28]';

const getModelTemplate = (
  model: DialAIEntityModel | ConversationEntityModel,
  label: string,
) => (
  <>
    <span className="text-secondary">{label}:</span>
    <div
      className="flex items-center gap-2"
      data-qa={label.toLowerCase().concat('-info')}
    >
      <ModelIcon
        entityId={model.id}
        entity={model as DialAIEntityModel}
        size={18}
      />
      {getOpenAIEntityFullName(model as DialAIEntityModel)}
    </div>
  </>
);

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
    (type?: EntityType) => {
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
          getModelLabel((model as DialAIEntityModel).type),
        )}
      {(model as DialAIEntityModel).version && (
        <>
          <span className="text-secondary">{t('Version')}:</span>
          <div data-qa="version-info">
            {(model as DialAIEntityModel).version}
          </div>
        </>
      )}
      {subModel != null && getModelTemplate(subModel, t('Assistant model'))}
      {prompt && (
        <>
          <span className="text-secondary">{t('System prompt')}:</span>
          <div
            className={classNames('whitespace-pre-wrap', lineClampClass)}
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
                className="flex gap-2 whitespace-pre rounded bg-accent-primary-alpha px-3 py-2"
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
