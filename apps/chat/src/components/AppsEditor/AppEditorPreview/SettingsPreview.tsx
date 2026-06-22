import {
  IconCloudUpload,
  IconMessages,
  IconRefresh,
} from '@tabler/icons-react';
import { FocusEvent, useCallback, useEffect, useMemo } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useApplicationStatusActions } from '@/src/hooks/useApplicationStatusActions';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isApplicationDeployed,
  isApplicationDeploymentInProgress,
  isExternalAppEditor,
} from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApplicationTypeSchemaProperties } from '@/src/types/application-type-schema';
import { ApplicationStatus, ApplicationType } from '@/src/types/applications';
import { ScreenState } from '@/src/types/common';
import { MarketplaceEditorSteps, PreviewMode } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ApplicationTypesSchemasSelectors,
  ConversationsSelectors,
  MarketplaceSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { CHAT_TEXT_FIELD_ID } from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';

import { GeneralPreview } from '@/src/components/AppsEditor/AppEditorPreview/GeneralPreview';
import { Chat } from '@/src/components/Chat/Chat';
import { Spinner } from '@/src/components/Common/Spinner';
import { PreviewModeButton } from '@/src/components/Marketplace/MarketplaceEditorView/PreviewModeButton';
import { useMarketplaceEditorView } from '@/src/components/Marketplace/MarketplaceEditorView/marketplaceEditorViewContext';

import { UploadStatus } from '@epam/ai-dial-shared';
import { DialLinkButton } from '@epam/ai-dial-ui-kit';

const ChatPreview = () => {
  const { t } = useTranslation(Translation.Chat);

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
  const { handleDeploy } = useApplicationStatusActions(applicationId);

  const modelFromState = appReference ? modelsMap[appReference] : null;
  const isAppDeployed = useMemo(
    () => !!modelFromState && isApplicationDeployed(modelFromState),
    [modelFromState],
  );
  const isAppDeploymentInProgress = useMemo(
    () => !!modelFromState && isApplicationDeploymentInProgress(modelFromState),
    [modelFromState],
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
            <span>
              {modelFromState?.functionStatus === ApplicationStatus.REDEPLOYING
                ? t(ChatI18nKeys.Redeploying)
                : modelFromState?.functionStatus ===
                    ApplicationStatus.UNDEPLOYING
                  ? t(ChatI18nKeys.Undeploying)
                  : t(ChatI18nKeys.Deploying)}
            </span>
          </div>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center text-secondary">
              <IconMessages size={60} stroke={0.5} />
            </div>
            <DialLinkButton
              label={t(ChatI18nKeys.DeployCodeApp)}
              onClick={handleDeploy}
              disabled={!isApplicationValid}
              data-qa="deploy-code-app"
              iconBefore={<IconCloudUpload size={18} />}
            />
            <div className="w-full max-w-[420px] items-center justify-center text-center text-primary">
              {t(ChatI18nKeys.FillMandatoryFieldsAndDeploy)}
              <span className="font-semibold">
                {t(ChatI18nKeys.MakeSureToRedeploy)}
              </span>
              {t(ChatI18nKeys.AfterMakingChanges)}
            </div>
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

  const { handleRedeploy } = useApplicationStatusActions(appDetails?.id);

  const isExternalAppEditing = useMemo(() => isExternalAppEditor(type), [type]);

  const isPreviewHalf = previewMode === PreviewMode.half;
  const isPreviewFull = previewMode === PreviewMode.full;
  const isPreviewClosed = previewMode === PreviewMode.closed;

  const isAppPublic = appDetails ? isEntityIdPublic(appDetails) : false;
  const modelFromState = appDetails ? modelsMap[appDetails.reference] : null;
  const isAppDeployed = useMemo(
    () => !!modelFromState && isApplicationDeployed(modelFromState),
    [modelFromState],
  );
  const schema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );
  const hasCustomEditor =
    !!schema?.[ApplicationTypeSchemaProperties.applicationTypeEditorUrl];

  const showRedeployButton =
    type === ApplicationType.CODE_APP && isAppDeployed && !isAppPublic;

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

  const screenState = useScreenState();

  return (
    <>
      <div
        className={classNames(
          'flex max-w-full items-center justify-between px-0 py-3 max-md:self-end md:px-5 md:py-4 xl:px-5 xl:py-4',
          isExternalAppEditing && 'hidden',
        )}
        data-qa="preview-header"
      >
        <div className="me-2 hidden min-w-0 shrink gap-2 text-primary md:flex">
          <span>{t(ChatI18nKeys.Preview)}:</span>
          <span data-qa="preview-app-name" className="min-w-0 shrink truncate">
            {appDetails?.name}
          </span>
          <span data-qa="preview-app-version" className="text-nowrap">
            {t(ChatI18nKeys.VersionPrefix)} {appDetails?.version}
          </span>
        </div>

        <div className="flex space-x-2">
          {showRedeployButton && (
            <DialLinkButton
              data-qa="redeploy-code-app"
              disabled={!isApplicationValid}
              onClick={handleRedeploy}
              iconBefore={<IconRefresh size={18} />}
              label={t(ChatI18nKeys.Redeploy)}
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
              className="rotate-180 max-xl:hidden"
            />
          )}
          {(hasCustomEditor || screenState <= ScreenState.MD) && (
            <PreviewModeButton
              mode={PreviewMode.closed}
              className="max-md:hidden"
            />
          )}
        </div>
      </div>

      {!isPreviewClosed && !!appDetails && (
        <div className="grow overflow-hidden" onFocus={handleFocusChat}>
          {!isExternalAppEditing ? (
            <ChatPreview />
          ) : (
            <GeneralPreview entity={appDetails} dataQA="preview-body" />
          )}
        </div>
      )}
    </>
  );
};
