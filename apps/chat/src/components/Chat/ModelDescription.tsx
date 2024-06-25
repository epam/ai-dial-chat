import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

interface Props {
  iconSize?: number;
  model: DialAIEntityModel;
  hideMoreInfo?: boolean;
  className?: string;
  isShortDescription?: boolean;
}

export const ModelDescription = ({
  iconSize = 24,
  model,
  hideMoreInfo,
  className,
  isShortDescription,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex flex-col gap-3" data-qa="more-info">
      {!hideMoreInfo && <span>{t('More info')}</span>}
      <div
        className={classNames('flex items-center gap-2', className)}
        data-qa="entity-info"
      >
        <ModelIcon entity={model} entityId={model.id} size={iconSize} />
        <span>{getOpenAIEntityFullName(model)}</span>
      </div>
      {model.description && (
        <span
          className="whitespace-pre-wrap text-xs text-secondary"
          data-qa="entity-descr"
        >
          <EntityMarkdownDescription isShortDescription={isShortDescription}>
            {model.description}
          </EntityMarkdownDescription>
        </span>
      )}
    </div>
  );
};
