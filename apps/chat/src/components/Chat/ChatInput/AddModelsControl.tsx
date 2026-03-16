import { IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ModelsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, ModelsSelectors } from '@/src/store/selectors';

import { ScrollDownButton } from '@/src/components/Common/ScrollDownButton';

import { DialNeutralButton } from '@epam/ai-dial-ui-kit';

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
        updateRecentModels: true,
      }),
    );
  };

  return (
    <div className="flex justify-center">
      <div className="relative mx-2 mb-2 flex w-full flex-row items-center justify-center gap-3 md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:w-[768px] lg:max-w-3xl">
        <DialNeutralButton
          onClick={handleInstallModels}
          className="inset-x-0 !-top-10 mx-auto w-fit py-3"
          data-qa="add-model-to-workspace"
          iconBefore={<IconPlayerPlay size={18} />}
          label={t(
            `Add the agent${modelIdsToInstall.length > 1 ? 's' : ''} to My workspace to continue`,
          )}
        />
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
