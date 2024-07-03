import { IconDots } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getApplicationIcon } from '@/src/utils/app/applications';

import { DisplayMenuItemProps } from '@/src/types/menu';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { TourGuideId } from '@/src/constants/share';

import ContextMenu from '@/src/components/Common/ContextMenu';
import { Spinner } from '@/src/components/Common/Spinner';

import PlusIcon from '../../../public/images/icons/plus-large.svg';

import {
  AllApplicationsIcon,
  NewConversationIcon,
  UnpinIcon,
} from '@/src/icons';
import { Feature } from '@epam/ai-dial-shared';

export const NewConversationActionButton = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const messageIsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );
  const isActiveNewConversationRequest = useAppSelector(
    ConversationsSelectors.selectIsActiveNewConversationRequest,
  );
  const isNewConversationDisabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideNewConversation),
  );
  const talkTo = useAppSelector(ConversationsSelectors.selectTalkTo);

  if (isNewConversationDisabled) {
    return null;
  }

  return (
    <div className="flex">
      <button
        className="bg-pr-secondary-550 hover:bg-pr-secondary-650 disabled:bg-pr-secondary-550-alpha mx-5 my-2 flex shrink-0 grow cursor-pointer select-none items-center justify-center gap-2 rounded-2xl px-3 py-2 leading-3 transition-colors duration-200 disabled:cursor-not-allowed"
        onClick={() => {
          talkTo && dispatch(ConversationsActions.setTalkTo(''));
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
            }),
          );
          dispatch(ConversationsActions.resetSearch());
        }}
        disabled={messageIsStreaming || isActiveNewConversationRequest}
        data-qa="new-entity"
        id={TourGuideId.newConversation}
      >
        {isActiveNewConversationRequest ? (
          <Spinner size={18} className={'text-primary-bg-dark'} />
        ) : (
          <PlusIcon width={18} height={18} />
        )}
        {t('New conversation')}
      </button>
    </div>
  );
};

export const AllApplicationsActionButton = () => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();

  const isExploreAllConversationsSelected = useAppSelector(
    ConversationsSelectors.selectIsExploreAllConversationsSelected,
  );

  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  useEffect(() => {
    if (selectedConversationsIds.length) {
      dispatch(ConversationsActions.setIsExploreAllApplicationsSelected(false));
    }
  }, [dispatch, selectedConversationsIds]);

  return (
    <div className="flex">
      <button
        className={classNames(
          'flex min-h-[50px] shrink-0 grow cursor-pointer select-none items-center justify-start gap-2  border-l-4 px-5 py-2 leading-3 hover:bg-accent-primary-alpha',
          isExploreAllConversationsSelected
            ? 'border-l-accent-primary bg-accent-primary-alpha'
            : 'border-l-quinary',
        )}
        onClick={() => {
          dispatch(ConversationsActions.clearSelectedConversationsIds());
          dispatch(PublicationActions.clearSelectedPublication());
          dispatch(
            ConversationsActions.setIsExploreAllApplicationsSelected(true),
          );
        }}
        data-qa="all-applications"
      >
        <AllApplicationsIcon />
        {t('Explore all applications')}
      </button>
    </div>
  );
};

const FavoriteApplicationActionButton = ({
  app,
}: {
  app: DialAIEntityModel;
}) => {
  const { t } = useTranslation(Translation.SideBar);
  const dispatch = useAppDispatch();
  const [isMenuOpened, setIsMenuOpened] = useState(false);
  const [isSelected, setIsSelected] = useState(false);
  const AppIcon = getApplicationIcon(app.id);
  const onCreateNewConversation = useCallback(() => {
    dispatch(
      ConversationsActions.createNewConversations({
        names: [DEFAULT_CONVERSATION_NAME],
        modelId: app.id,
      }),
    );
    setIsMenuOpened(false);
    setIsSelected(false);
  }, [dispatch, app]);

  const onUpdateFavoriteApp = useCallback(() => {
    dispatch(
      ModelsActions.updateFavoriteApplicationsIds({
        appsIds: [app.id],
        isFavorite: false,
      }),
    );
    setIsMenuOpened(false);
    setIsSelected(false);
  }, [dispatch, app]);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () =>
      [
        {
          name: t('New Conversation'),
          display: true,
          dataQa: 'new-conversation',
          Icon: NewConversationIcon,
          onClick: onCreateNewConversation,
          disabled: false,
        },
        {
          name: t('Remove from sidebar'),
          display: true,
          dataQa: 'remove-from-sidebar',
          Icon: UnpinIcon,
          onClick: onUpdateFavoriteApp,
          disabled: false,
        },
      ] as DisplayMenuItemProps[],
    [onCreateNewConversation, onUpdateFavoriteApp],
  );

  return (
    <div
      className={classNames(
        'group flex items-center justify-between hover:bg-accent-primary-alpha',
        isSelected && 'bg-accent-primary-alpha',
      )}
    >
      <button
        className={classNames(
          'group flex size-full min-h-[45px] cursor-pointer select-none items-center gap-2 border-l-4  py-2 pl-4 pr-2 leading-3',
          isSelected ? 'border-l-accent-primary' : 'border-l-quinary',
        )}
        onClick={() => {
          dispatch(
            ConversationsActions.createNewConversations({
              names: [DEFAULT_CONVERSATION_NAME],
              modelId: app.id,
            }),
          );
        }}
        data-qa="all-applications"
      >
        <AppIcon />
        <span>{app.name}</span>
      </button>
      <ContextMenu
        menuItems={menuItems}
        TriggerIcon={IconDots}
        triggerIconSize={18}
        triggerIconClassName="pr-4 h-full flex items-center hover:cursor-pointer invisible group-hover:visible"
        isOpen={isMenuOpened}
        onOpenChange={(isOpen) => {
          setIsMenuOpened(isOpen);
          setIsSelected(isOpen);
        }}
      />
    </div>
  );
};

export const ChatbarActionButtons = () => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const favoriteAppIds = useAppSelector(
    ModelsSelectors.selectFavoriteApplicationsIds,
  );
  const favoriteApps = favoriteAppIds.map(
    (id) => modelsMap[id],
  ) as DialAIEntityModel[];

  return (
    <>
      <NewConversationActionButton />
      <AllApplicationsActionButton />
      {favoriteApps.map((app) => (
        <FavoriteApplicationActionButton key={app?.id} app={app} />
      ))}
    </>
  );
};
