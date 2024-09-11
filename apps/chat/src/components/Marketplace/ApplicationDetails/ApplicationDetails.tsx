import { useCallback, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { compareIdWithQueryParamId } from '@/src/utils/app/common';
import { getConversationModelParams } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
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

import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import Modal from '../../Common/Modal';
import { ApplicationDetailsContent } from './ApplicationContent';
import { ApplicationDetailsFooter } from './ApplicationFooter';
import { ApplicationDetailsHeader } from './ApplicationHeader';

interface Props {
  onClose: () => void;
  entity: DialAIEntityModel;
}

const ApplicationDetails = ({ onClose, entity }: Props) => {
  const dispatch = useAppDispatch();

  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedVersionEntity, setSelectedVersionEntity] = useState(entity);

  const entities = useAppSelector(ModelsSelectors.selectModels);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const addonsMap = useAppSelector(AddonsSelectors.selectAddonsMap);

  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => entity.name === e.name);
  }, [entities, entity.name]);

  const handleUseEntity = useCallback(() => {
    const conversationToApplyModel =
      selectedConversations.find((conv) =>
        compareIdWithQueryParamId(
          conv.id,
          searchParams.get(MarketplaceQueryParams.fromConversation),
        ),
      ) ?? selectedConversations[0];

    dispatch(
      ConversationsActions.updateConversation({
        id: conversationToApplyModel.id,
        values: {
          ...getConversationModelParams(
            conversationToApplyModel,
            entity.id,
            modelsMap,
            addonsMap,
          ),
        },
      }),
    );
    dispatch(
      ModelsActions.updateRecentModels({
        modelId: entity.id,
      }),
    );

    router.push('/');
  }, [
    addonsMap,
    dispatch,
    entity.id,
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
      containerClassName="flex w-full flex-col divide-y divide-tertiary divide-tertiary md:max-w-[700px] xl:max-w-[720px] max-w-[328px]"
      onClose={onClose}
    >
      <ApplicationDetailsHeader
        entity={selectedVersionEntity}
        onClose={onClose}
      />
      <ApplicationDetailsContent entity={selectedVersionEntity} />
      <ApplicationDetailsFooter
        onUseEntity={handleUseEntity}
        onChangeVersion={(entity: DialAIEntityModel) =>
          setSelectedVersionEntity(entity)
        }
        modelType={EntityType.Model}
        entity={selectedVersionEntity}
        entities={filteredEntities}
      />
    </Modal>
  );
};

export default ApplicationDetails;
