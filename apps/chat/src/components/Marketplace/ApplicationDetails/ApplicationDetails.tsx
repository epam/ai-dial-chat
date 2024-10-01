import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { getConversationModelParams } from '@/src/utils/app/conversation';

import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';

import { AddonsSelectors } from '@/src/store/addons/addons.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import Modal from '../../Common/Modal';
import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

import { PublishActions } from '@epam/ai-dial-shared';

interface Props {
  isMobileView: boolean;
  entity: DialAIEntityModel;
  allEntities: DialAIEntityModel[];
  onlyInstalledVersions: boolean;
  onClose: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
  onEdit: (entity: DialAIEntityModel) => void;
}

const ApplicationDetails = ({
  entity,
  isMobileView,
  allEntities,
  onlyInstalledVersions,
  onClose,
  onPublish,
  onEdit,
}: Props) => {
  const dispatch = useAppDispatch();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedVersionEntity, setSelectedVersionEntity] = useState(entity);

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const filteredEntities = useMemo(() => {
    return allEntities.filter(
      (e) =>
        entity.name === e.name &&
        (!onlyInstalledVersions || installedModelIds.has(e.id)),
    );
  }, [allEntities, entity.name, installedModelIds, onlyInstalledVersions]);

  const handleUseEntity = useCallback(() => {
    const queryParamId = searchParams.get(
      MarketplaceQueryParams.fromConversation,
    );
    const conversationToApplyModel = selectedConversations.find(
      (conv) => conv.id === queryParamId,
    );

    if (conversationToApplyModel) {
      dispatch(
        ConversationsActions.updateConversation({
          id: conversationToApplyModel.id,
          values: {
            ...getConversationModelParams(
              conversationToApplyModel,
              selectedVersionEntity.reference,
              modelsMap,
              addonsMap,
            ),
          },
        }),
      );
    } else {
      dispatch(
        ConversationsActions.createNewConversations({
          names: [DEFAULT_CONVERSATION_NAME],
          modelReference: selectedVersionEntity.reference,
        }),
      );
    }

    dispatch(
      ModelsActions.updateRecentModels({
        modelId: selectedVersionEntity.reference,
        rearrange: true,
      }),
    );

    if (!installedModelIds.has(selectedVersionEntity.reference)) {
      dispatch(
        ModelsActions.updateInstalledModels([
          ...installedModels,
          { id: selectedVersionEntity.reference },
        ]),
      );
    }

    router.push('/');
  }, [
    addonsMap,
    dispatch,
    installedModelIds,
    installedModels,
    modelsMap,
    router,
    searchParams,
    selectedConversations,
    selectedVersionEntity.reference,
  ]);

  useEffect(() => {
    setSelectedVersionEntity(entity);
  }, [entity]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-application-details"
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary divide-tertiary xl:max-w-[720px] max-w-[700px]"
      onClose={onClose}
    >
      <ApplicationDetailsHeader
        isMobileView={isMobileView}
        entity={selectedVersionEntity}
      />
      <ApplicationDetailsContent entity={selectedVersionEntity} />
      <ApplicationDetailsFooter
        onPublish={onPublish}
        onUseEntity={handleUseEntity}
        onChangeVersion={setSelectedVersionEntity}
        entity={selectedVersionEntity}
        allVersions={filteredEntities}
        onEdit={onEdit}
      />
    </Modal>
  );
};

export default ApplicationDetails;
