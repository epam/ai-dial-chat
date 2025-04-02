import { IconMessages, IconPlayerPlay } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ApplicationStatus, ApplicationType } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { Chat } from '@/src/components/Chat/Chat';
import { Spinner } from '@/src/components/Common/Spinner';

import { UploadStatus } from '@epam/ai-dial-shared';

interface Props {
  onPreviewMouseLeave: () => void;
  onPreviewMouseEnter: () => void;
  isAppDeploymentInProgress: boolean;
  isApplicationValid: boolean;
  applicationId: string;
  type: string;
  isAppDeployed: boolean;
  isExiting?: boolean;
}

export const ApplicationPreviewChat: React.FC<Props> = ({
  onPreviewMouseLeave,
  onPreviewMouseEnter,
  isAppDeploymentInProgress,
  isApplicationValid,
  applicationId,
  type,
  isAppDeployed,
  isExiting,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const appLoading = useAppSelector(ApplicationSelectors.selectAppLoading);
  const isConversationInitialized = useAppSelector(
    ConversationsSelectors.selectInitialized,
  );
  const areSelectedConversationLoaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );

  if (
    !areSelectedConversationLoaded ||
    !isConversationInitialized ||
    !areSelectedConversationsLoaded
  ) {
    return null;
  }

  return (
    <div
      onMouseEnter={onPreviewMouseEnter}
      onMouseLeave={onPreviewMouseLeave}
      className="relative flex size-full min-w-0 grow flex-col"
    >
      {appLoading === UploadStatus.LOADING && (
        <div className="absolute flex size-full items-center justify-center bg-layer-2">
          <Spinner size={30} />
        </div>
      )}
      {type === ApplicationType.CODE_APP && !isAppDeployed ? (
        isAppDeploymentInProgress ? (
          <div className="flex size-full flex-col items-center justify-center gap-4">
            <Spinner size={60} />
            <span>{t('Deploying...')}</span>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center text-secondary">
              <IconMessages size={45} />
            </div>
            <div className="w-full max-w-[420px] items-center justify-center text-center text-primary">
              {t(
                'Please fill the mandatory fields and deploy the application to enable preview. To keep your preview up-to-date,',
              )}
              <span className="font-semibold">
                {t(' make sure to redeploy ')}
              </span>
              {t('after making changes.')}
            </div>
            <button
              className="button button-accent-secondary mb-2 flex items-center gap-2 text-accent-secondary md:mx-4 md:mb-0 md:last:mb-6 lg:mx-auto lg:max-w-3xl"
              data-qa="deploy-code-app"
              disabled={!isApplicationValid}
              onClick={() => {
                dispatch(
                  ApplicationActions.startUpdatingFunctionStatus({
                    id: applicationId,
                    status: ApplicationStatus.DEPLOYING,
                  }),
                );
              }}
            >
              <IconPlayerPlay size={18} />
              <span>{t('Deploy code app')}</span>
            </button>
          </div>
        )
      ) : isExiting ? (
        <div className="size-full" />
      ) : (
        <Chat isPreview />
      )}
    </div>
  );
};
