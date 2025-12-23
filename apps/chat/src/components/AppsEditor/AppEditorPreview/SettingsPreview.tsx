import { IconMessages, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import React, { FocusEvent, useCallback, useEffect, useMemo } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
} from '@/src/utils/app/application';
import { DefaultsService } from '@/src/utils/app/data/defaults-service';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationStatus, ApplicationType } from '@/src/types/applications';
import { MarketplaceEditorSteps, PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { ApplicationActions, ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ConversationsSelectors,
  MarketplaceSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { CHAT_TEXT_FIELD_ID } from '@/src/constants/chat';
import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';

import { GeneralPreview } from '@/src/components/AppsEditor/AppEditorPreview/GeneralPreview';
import { Chat } from '@/src/components/Chat/Chat';
import { Spinner } from '@/src/components/Common/Spinner';
import { PreviewModeButton } from '@/src/components/Marketplace/MarketplaceEditorView/PreviewModeButton';
import { useMarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/marketplaceEditorViewContext';

import { UploadStatus } from '@epam/ai-dial-shared';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

const ChatPreview = () => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const router = useRouter();
  const {
    [AppsEditorQuery.Schema]: typeQuery = '',
    [AppsEditorQuery.Id]: referenceQuery,
  } = router.query;
  const type = decodeURIComponent(typeQuery.toString());
  const appReference = decodeURIComponent(referenceQuery?.toString() ?? '');

  const { control } = useFormContext();
  const { isValid: isApplicationValid } = useFormState({ control });

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
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
  const showMarketplaceLoader = useAppSelector(
    MarketplaceSelectors.selectShowLoader,
  );

  const applicationId = appDetails?.id;
  const modelFromState = appReference ? modelsMap[appReference] : null;
  const isAppDeployed = useMemo(
    () => !!modelFromState && isApplicationDeployed(modelFromState),
    [modelFromState],
  );
  const isAppDeploymentInProgress = useMemo(
    () => !!modelFromState && isApplicationDeploymentInProgress(modelFromState),
    [modelFromState],
  );

  const handleDeployClick = useCallback(() => {
    if (applicationId) {
      dispatch(
        ApplicationActions.startUpdatingFunctionStatus({
          id: applicationId,
          status: ApplicationStatus.DEPLOYING,
        }),
      );
    }
  }, [applicationId, dispatch]);

  if (
    !areSelectedConversationLoaded ||
    !isConversationInitialized ||
    !areSelectedConversationsLoaded
  ) {
    return null;
  }

  return (
    <div
      className="relative flex size-full min-w-0 grow flex-col"
      data-qa="preview-body"
    >
      {appLoading === UploadStatus.LOADING && !showMarketplaceLoader && (
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
            <DialButton
              label={t('Deploy code app')}
              className="text-accent-secondary"
              variant={ButtonVariant.Tertiary}
              onClick={handleDeployClick}
              disabled={!isApplicationValid}
              data-qa="deploy-code-app"
              iconBefore={<IconPlayerPlay size={18} />}
            />
          </div>
        )
      ) : (
        <Chat isPreview />
      )}
    </div>
  );
};

interface SettingsPreviewProps {
  onSave: () => void;
}

export const SettingsPreview = ({ onSave }: SettingsPreviewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const router = useRouter();
  const { [AppsEditorQuery.Schema]: typeQuery = '' } = router.query;
  const type = decodeURIComponent(typeQuery.toString());
  const { previewMode } = useMarketplaceEditorView();

  const { control } = useFormContext();
  const { isValid: isApplicationValid } = useFormState({ control });

  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const isConversationInitialized = useAppSelector(
    ConversationsSelectors.selectInitialized,
  );
  const areConversationsUploaded = useAppSelector(
    ConversationsSelectors.areConversationsUploaded,
  );
  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );
  const previewConversationId = useAppSelector(
    ConversationsSelectors.selectPreviewConversationId,
  );

  const externalAppsSchemaId = useMemo(() => {
    return DefaultsService.get(
      'externalAppsSchemaId',
      DEFAULT_EXTERNAL_APPS_SCHEMA_ID,
    );
  }, []);

  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;
  const isPreviewClosed = previewMode === PreviewMode.closed;

  const isAppPublic = appDetails ? isEntityIdPublic(appDetails) : false;
  const modelFromState = appDetails ? modelsMap[appDetails.reference] : null;
  const isAppDeployed = useMemo(
    () => !!modelFromState && isApplicationDeployed(modelFromState),
    [modelFromState],
  );

  const showRedeployButton =
    type === ApplicationType.CODE_APP && isAppDeployed && !isAppPublic;

  const handleRedeploy = () => {
    dispatch(
      ApplicationActions.startUpdatingFunctionStatus({
        id: appDetails?.id ?? '',
        status: ApplicationStatus.REDEPLOYING,
      }),
    );
  };

  const handleFocusChat = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (e.target.id === CHAT_TEXT_FIELD_ID && !isAppPublic) {
        onSave();
      }
    },
    [isAppPublic, onSave],
  );

  useEffect(() => {
    if (
      !areConversationsUploaded ||
      !isConversationInitialized ||
      !areSelectedConversationsLoaded ||
      editorStep !== MarketplaceEditorSteps.Settings
    )
      return;
    if (previewConversationId) {
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [previewConversationId],
        }),
      );
    } else {
      dispatch(
        ConversationsActions.createNewConversations({
          names: ['Preview Conversation'],
          modelReference: appDetails?.reference,
        }),
      );
    }
  }, [
    editorStep,
    appDetails?.reference,
    areConversationsUploaded,
    areSelectedConversationsLoaded,
    dispatch,
    isConversationInitialized,
    previewConversationId,
  ]);

  return (
    <>
      <div
        className="flex max-w-full items-center justify-between px-0 py-3 max-md:self-end md:px-5 md:py-4 xl:px-5 xl:py-4"
        data-qa="preview-header"
      >
        <div className="mr-2 hidden min-w-0 shrink gap-2 text-primary md:flex">
          <span>{t('Preview')}:</span>
          <span data-qa="preview-app-name" className="min-w-0 shrink truncate">
            {appDetails?.name}
          </span>
          <span data-qa="preview-app-version" className="text-nowrap">
            {t('v.')} {appDetails?.version}
          </span>
        </div>

        <div className="flex space-x-2">
          {showRedeployButton && (
            <DialButton
              className="text-accent-secondary"
              variant={ButtonVariant.Tertiary}
              data-qa="redeploy-code-app"
              disabled={!isApplicationValid}
              onClick={handleRedeploy}
              iconBefore={<IconRefresh size={18} />}
              label={t('Redeploy')}
            />
          )}
          {isPreviewHalf && (
            <PreviewModeButton
              mode={PreviewMode.full}
              className="max-xl:hidden"
            />
          )}
          {isPreviewFull && (
            <PreviewModeButton
              mode={PreviewMode.half}
              className="max-xl:hidden"
            />
          )}
          <PreviewModeButton
            mode={PreviewMode.closed}
            className="max-md:hidden"
          />
        </div>
      </div>

      {!isPreviewClosed && !!appDetails && (
        <div className="grow overflow-hidden" onFocus={handleFocusChat}>
          {!externalAppsSchemaId.endsWith(type) ? (
            <ChatPreview />
          ) : (
            <GeneralPreview entity={appDetails} dataQA="preview-body" />
          )}
        </div>
      )}
    </>
  );
};
