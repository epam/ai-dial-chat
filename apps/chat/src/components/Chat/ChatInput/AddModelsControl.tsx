import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { ScrollDownButton } from '../../Common/ScrollDownButton';

interface Props {
  showScrollDownButton: boolean;
  onScrollDown: () => void;
}

export const AddModelsControl = ({
  showScrollDownButton,
  onScrollDown,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const modelIdsToInstall = selectedConversations
    .filter((conv) => !installedModelIds.has(conv.model.id))
    .map((conv) => conv.model.id);

  const handleInstallModels = () => {
    dispatch(
      ModelsActions.addInstalledModels({
        references: modelIdsToInstall,
        showSuccessToast: true,
      }),
    );
  };

  return (
    <div className="flex justify-center">
      <div className="relative mx-2 mb-2 flex w-full flex-row items-center justify-center gap-3 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl">
        <button
          onClick={handleInstallModels}
          className="button inset-x-0 !-top-10 mx-auto flex w-fit items-center gap-2 border-primary bg-layer-2 p-3 hover:bg-layer-4"
          data-qa="add-model-to-workspace"
        >
          <IconPlayerPlay size={18} />
          {t(
            `Add the agent${modelIdsToInstall.length > 1 ? 's' : ''} to My workspace to continue`,
          )}
        </button>
        {showScrollDownButton && (
          <ScrollDownButton
            className="-top-16 right-0 md:-top-20"
            onScrollDownClick={onScrollDown}
          />
        )}
      </div>
    </div>
  );
};
