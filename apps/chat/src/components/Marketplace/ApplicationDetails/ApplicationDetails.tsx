import { useCallback, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { getConversationModelParams } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';

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

interface Props {
  isMobileView: boolean;
  entity: DialAIEntityModel;
  onClose: () => void;
  onPublish: (entity: DialAIEntityModel, action: PublishActions) => void;
}

const ApplicationDetails = ({
  entity,
  isMobileView,
  onClose,
  onPublish,
}: Props) => {
  const dispatch = useAppDispatch();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedVersionEntity, setSelectedVersionEntity] = useState(entity);

  const entities = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);
  const installedModels = useAppSelector(ModelsSelectors.selectInstalledModels);
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => entity.name === e.name);
  }, [entities, entity.name]);

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
              entity.reference,
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
          modelReference: entity.reference,
        }),
      );
    }

    if (!installedModels.map((model) => model.id).includes(entity.reference)) {
      dispatch(
        ModelsActions.updateInstalledModels([
          ...installedModels,
          { id: entity.reference },
        ]),
      );
    }

    router.push('/');
  }, [
    addonsMap,
    dispatch,
    entity.reference,
    installedModels,
    modelsMap,
    router,
    searchParams,
    selectedConversations,
  ]);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="marketplace-application-details"
      hideClose
      overlayClassName="!z-40"
      containerClassName="flex w-full flex-col divide-y divide-tertiary divide-tertiary md:max-w-[700px] xl:max-w-[720px] max-w-[328px]"
      onClose={onClose}
    >
      <ApplicationDetailsHeader
        isMobileView={isMobileView}
        entity={selectedVersionEntity}
        onClose={onClose}
      />
      <ApplicationDetailsContent entity={selectedVersionEntity} />
      <ApplicationDetailsFooter
        onPublish={onPublish}
        onUseEntity={handleUseEntity}
        onChangeVersion={setSelectedVersionEntity}
        modelType={EntityType.Model}
        entity={selectedVersionEntity}
        entities={filteredEntities}
      />
    </Modal>
  );
};

export default ApplicationDetails;
