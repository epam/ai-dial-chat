import { TFunction, useTranslation } from 'next-i18next';

import { getApplicationIcon } from '@/src/utils/app/applications';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { HEADER_TITLE_TEXT, ModelId } from '@/src/constants/chat';

import { PopularPrompts } from '@/src/components/Chat/PopularPrompts';

import SecondaryLogo from '@/public/images/icons/secondary-logo.svg';
import { DallSquareIcon } from '@/src/icons';

export const ApplicationMessagesEmpty = ({
  application,
  t,
}: {
  application: DialAIEntityModel;
  t: TFunction;
}) => {
  const AppIcon = getApplicationIcon(application.id, true);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div>
        <AppIcon width={60} height={60} />
      </div>
      <div className="font-weave text-3xl font-bold text-pr-primary-700">
        {application.name}
      </div>
      <div className="flex items-center justify-center text-xs font-medium text-pr-primary-700">
        {application.id === ModelId.HR_BUDDY && (
          <span>{t('Welcome to the dedicated chatbot for HR Campaigns!')}</span>
        )}
        {application.id === ModelId.WEB_RAG && (
          <span>
            {t('Search and retrieve information from the web in real-time')}
          </span>
        )}
      </div>
      <div className="mt-5 flex items-center justify-center">
        <PopularPrompts model={application} />
      </div>
    </div>
  );
};

export const ModelMessagesEmpty = ({
  model,
  t,
}: {
  model: DialAIEntityModel;
  t: TFunction;
}) => (
  <>
    {model.id === ModelId.DALL ? (
      <div className="flex flex-col items-center justify-center gap-2">
        <DallSquareIcon />
        <div className="ml-3 font-weave text-3xl font-bold text-pr-primary-700">
          {model.name}
        </div>
        <div className="flex items-center justify-center text-xs font-medium text-pr-primary-700">
          {t('Let me turn your imagination into imagery.')}
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-center">
        <SecondaryLogo width={54} height={60} />
        <span className="ml-3 font-weave text-3xl font-bold text-pr-primary-700">
          {HEADER_TITLE_TEXT}
        </span>
      </div>
    )}
    <div className="flex items-center justify-center">
      <PopularPrompts model={model} />
    </div>
  </>
);

export const ChatMessagesEmpty = ({
  conversation,
}: {
  conversation: Conversation;
}) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const talkTo = useAppSelector(ConversationsSelectors.selectTalkTo);
  const modelId = conversation.model.id;
  const model = modelsMap[modelId];

  if (talkTo && talkTo !== modelId) return null;

  return (
    <>
      {model?.type === EntityType.Application && (
        <ApplicationMessagesEmpty application={model} t={t} />
      )}

      {model?.type === EntityType.Model && (
        <ModelMessagesEmpty model={model} t={t} />
      )}
    </>
  );
};
