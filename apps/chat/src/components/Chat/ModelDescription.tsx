import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

interface Props {
  model: DialAIEntityModel;
  hideMoreInfo?: boolean;
  className?: string;
  isShortDescription?: boolean;
}

export const ModelDescription = ({
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
        data-qa="info-app"
      >
        <ModelIcon
          entity={model}
          entityId={model.id}
          size={24}
          isSmallIconSize={false}
        />
        <span>{getOpenAIEntityFullName(model)}</span>
      </div>
      {model.description && (
        <span
          className="whitespace-pre-wrap text-xs text-secondary-bg-dark"
          data-qa="app-descr"
        >
          <EntityMarkdownDescription isShortDescription={isShortDescription}>
            {model.description}
          </EntityMarkdownDescription>
        </span>
      )}
    </div>
  );
};
