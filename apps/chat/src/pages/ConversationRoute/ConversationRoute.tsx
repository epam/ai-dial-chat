import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import { ResponseFormat } from '@epam/ai-dial-chat-shared';
import { FileDndOverlay } from '@epam/ai-dial-conversation-input';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ConversationResponseDto } from '@epam/chat-api-client';
import {
  FC,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import StarterButtons from '../../components/StarterButtons/StarterButtons';
import { MAX_SELECTABLE_FILE_SIZE_BYTES } from '../../constants/files';
import { CONVERSATION_ROUTE_INPUT_STYLES } from '../../constants/input-styles';
import { getConversationRoute } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useAttachmentValidation } from '../../hooks/attachment/useAttachmentValidation';
import { useOpenAttachmentCanvas } from '../../hooks/attachment/useOpenAttachmentCanvas';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useAttachmentUpload } from '../../hooks/conversation/useAttachmentUpload';
import { useAudioTranscription } from '../../hooks/conversation/useAudioTranscription';
import { useChatSettingsFormConfig } from '../../hooks/conversation/useChatSettingsFormConfig';
import { useModelSelectorLabels } from '../../hooks/conversation/useModelSelectorLabels';
import { useDialFileManagerState } from '../../hooks/files/useDialFileManagerState';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import useFavoriteApplications from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import { getApiErrorMessage } from '../../server-api/api-error';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { getConversationPath } from '../../utils/conversation-path';
import { getTimeOfDayGreeting } from '../../utils/greeting';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';
import {
  getStarterPopulateText,
  getStartersFromSchema,
} from '../../utils/starter-option';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

const DialFileManagerModal = lazy(async () => {
  const module =
    await import('../../components/DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

const ModelPickerPanel = lazy(
  () => import('../../components/ModelPicker/ModelPickerPanel'),
);

const CatalogPickerModal = lazy(async () => {
  const module =
    await import('../../components/ModelPicker/CatalogPickerModal');
  return { default: module.default };
});

/*
 * TODO: rename page and component
 * TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
 */
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const [chatSettingsValues, setChatSettingsValues] = useState({
    responseFormat: ResponseFormat.Markdown,
    systemPrompt: '',
    temperature: 0.5,
  });
  const { showNotification } = useNotification();
  const {
    config: { asrModelId, transcribeSizeLimitBytes },
  } = useAppConfig();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const {
    isOpen: isDialFileManagerOpen,
    openModal: openDialFileManager,
    closeModal: closeDialFileManager,
    pendingAttachments: pendingDialAttachments,
    clearPendingAttachments: clearPendingDialAttachments,
    handleAttach: handleAttachDialFiles,
  } = useDialFileManagerState(bucket);
  const inputRef = useRef<HTMLDivElement>(null);
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  const selectedDeployment = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const [isCatalogPickerOpen, setIsCatalogPickerOpen] = useState(false);

  const { favoriteIds, toggleFavorite } = useFavoriteApplications();
  const favoriteCatalogItems = useMemo(
    () =>
      items
        .filter((d) => favoriteIds.has(d.id))
        .map((d) => mapDeploymentToCatalogItem(d, favoriteIds)),
    [items, favoriteIds],
  );

  const { inputAttachmentTypes, isAttachmentsAllowed, validateAttachment } =
    useAttachmentValidation(selectedDeployment);

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      const { title, message } = buildNetworkUploadErrorNotification(
        filenames,
        t,
      );
      showNotification({
        variant: NotificationVariant.Error,
        title,
        message,
      });
    },
    [showNotification, t],
  );

  const { handleUploadAttachment } = useAttachmentUpload({
    bucket,
    onNetworkError: handleNetworkUploadError,
  });

  const { isDragging, pendingFiles, onFilesConsumed } = usePageFileDrag(
    isAttachmentsAllowed,
    !isDialFileManagerOpen,
  );

  const deploymentItems: DeploymentItem[] = useMemo(
    () =>
      items.map(({ id, displayName, iconUrl, type, inputAttachmentTypes }) => ({
        id,
        displayName,
        iconUrl: iconUrl ? resolveCatalogIconUrl(iconUrl) : undefined,
        type,
        inputAttachmentTypes,
      })),
    [items],
  );

  const { starters, propertyKey, description } = useMemo(
    () => getStartersFromSchema(selectedDeploymentConfiguration),
    [selectedDeploymentConfiguration],
  );

  const isInputDisabled = useMemo(
    () => !!selectedDeploymentConfiguration?.isChatMessageInputDisabled,
    [selectedDeploymentConfiguration],
  );

  const chatSettings = useChatSettingsFormConfig({
    mode: 'local',
    values: chatSettingsValues,
    onValuesChange: setChatSettingsValues,
    deploymentFeatures: selectedDeployment?.features,
  });

  const modelSelectorLabels = useModelSelectorLabels({
    isLoading,
    error,
    itemCount: items.length,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSend = useCallback(
    async (message: string, attachments: Attachment[]) => {
      if (isSending || !selectedItemId) return;
      setIsSending(true);
      try {
        const attachmentDtos = attachmentsToDtos(attachments || []);
        const conversation = await apiCreateConversation(
          message,
          selectedItemId,
          attachmentDtos,
        );
        const savedConversation = {
          ...conversation,
          prompt: chatSettingsValues.systemPrompt,
          temperature: chatSettingsValues.temperature,
          responseFormat: chatSettingsValues.responseFormat,
        } as ConversationResponseDto;
        await saveConversation(
          getConversationPath(conversation.id),
          savedConversation,
        );
        navigate(getConversationRoute(conversation.id), {
          state: { conversation: savedConversation },
        });
      } catch (err) {
        const errorMessage = await getApiErrorMessage(err);
        showNotification({
          variant: NotificationVariant.Error,
          message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
        });
      } finally {
        setIsSending(false);
      }
    },
    [
      navigate,
      isSending,
      selectedItemId,
      showNotification,
      t,
      chatSettingsValues,
    ],
  );

  const { handleUploadAudio, handleTranscribeAudio, isTranscriptionSupported } =
    useAudioTranscription({
      bucket,
      transcribeSizeLimitBytes,
      asrModelId,
      selectedDeploymentId: selectedItemId,
    });

  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();
  const { displayName } = useUserProfile();
  const firstName = displayName.split(' ')[0];
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();

  const handleAttachmentClick = useCallback(
    (attachment: Attachment) => {
      void openAttachmentCanvas(attachment);
    },
    [openAttachmentCanvas],
  );

  const handleStarterSelect = useCallback(
    (starter: StarterOption) => {
      if (starter['dial:widgetOptions'].submit) {
        const text = description ?? getStarterPopulateText(starter);
        if (!selectedItemId) {
          return;
        }

        const configurationValue = propertyKey
          ? { [propertyKey]: starter.const }
          : undefined;
        const createAndNavigate = async () => {
          try {
            const conversation = await apiCreateConversation(
              text,
              selectedItemId,
              [],
              configurationValue,
            );
            navigate(getConversationRoute(conversation.id));
          } catch (err) {
            const errorMessage = await getApiErrorMessage(err);
            showNotification({
              variant: NotificationVariant.Error,
              message: errorMessage ?? t(ChatI18nKeys.CreateConversationError),
            });
          }
        };

        void createAndNavigate();
      } else {
        const text = description ?? getStarterPopulateText(starter);
        setInputMessage(text);
      }
    },
    [description, propertyKey, selectedItemId, navigate, showNotification, t],
  );

  return (
    <div ref={inputRef} className="flex flex-1 flex-col overflow-y-auto">
      <FileDndOverlay
        isVisible={isDragging}
        isAttachmentsAllowed={isAttachmentsAllowed}
        title={t(
          isAttachmentsAllowed
            ? FileDndI18nKeys.OverlayTitle
            : FileDndI18nKeys.OverlayDeniedTitle,
        )}
        subtitle={t(
          isAttachmentsAllowed
            ? FileDndI18nKeys.OverlaySubtitle
            : FileDndI18nKeys.OverlayDeniedSubtitle,
        )}
      />
      <Suspense fallback={<RouteFallback />}>
        <div
          className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4 [container-type:inline-size] desktop:p-8"
          role="region"
          aria-label={t(ChatI18nKeys.WelcomeScreen)}
        >
          <ConversationInput
            onSend={handleSend}
            onUploadAttachment={handleUploadAttachment}
            message={inputMessage}
            welcomeText={getTimeOfDayGreeting(
              new Date().getHours(),
              {
                morningWithName: t(ChatI18nKeys.GreetingMorning, {
                  name: firstName,
                }),
                morningNoName: t(ChatI18nKeys.GreetingMorningNoName),
                afternoonWithName: t(ChatI18nKeys.GreetingAfternoon, {
                  name: firstName,
                }),
                afternoonNoName: t(ChatI18nKeys.GreetingAfternoonNoName),
                eveningWithName: t(ChatI18nKeys.GreetingEvening, {
                  name: firstName,
                }),
                eveningNoName: t(ChatI18nKeys.GreetingEveningNoName),
                nightWithName: t(ChatI18nKeys.GreetingNight, {
                  name: firstName,
                }),
                nightNoName: t(ChatI18nKeys.GreetingNightNoName),
              },
              firstName || undefined,
            )}
            placeholder={t(ChatI18nKeys.Placeholder)}
            styles={CONVERSATION_ROUTE_INPUT_STYLES}
            deployments={deploymentItems}
            selectedDeploymentId={selectedItemId}
            onDeploymentChange={setSelectedItemId}
            isInputDisabled={isInputDisabled}
            modelSelectorLabels={modelSelectorLabels}
            addMenuTitle={t(ConversationI18nKeys.AddMenuTitle)}
            sendLabel={t(ChatI18nKeys.SendMessage)}
            sendTitle={t(ChatI18nKeys.SendMessage)}
            stopLabel={t(ChatI18nKeys.StopStreaming)}
            isTranscriptionSupported={isTranscriptionSupported}
            onUploadAudio={handleUploadAudio}
            onTranscribeAudio={handleTranscribeAudio}
            sendOnEnter={sendOnEnter}
            chatSettings={chatSettings}
            pendingDropFiles={pendingFiles}
            onDropFilesConsumed={onFilesConsumed}
            pendingAttachments={pendingDialAttachments}
            onPendingAttachmentsConsumed={clearPendingDialAttachments}
            autoFocus={!isMobile}
            onDialFileSystemClick={
              isAttachmentsAllowed ? openDialFileManager : undefined
            }
            dialFileSystemLabel={t(
              ConversationI18nKeys.AttachMenuDialFileSystem,
            )}
            validateAttachment={
              selectedDeployment != null ? validateAttachment : undefined
            }
            hideAttachFile={!isAttachmentsAllowed}
            onAttachmentClick={handleAttachmentClick}
            modelPickerOverlay={(onClose) => (
              <Suspense fallback={null}>
                <ModelPickerPanel
                  favorites={favoriteCatalogItems}
                  selectedId={selectedItemId}
                  onSelect={setSelectedItemId}
                  onToggleFavorite={toggleFavorite}
                  onBrowseCatalog={() => setIsCatalogPickerOpen(true)}
                  onClose={onClose}
                  labels={{
                    searchPlaceholder: t(
                      CatalogI18nKeys.PickerSearchPlaceholder,
                    ),
                    searchAriaLabel: t(CatalogI18nKeys.PickerSearchAriaLabel),
                    emptyHint: t(CatalogI18nKeys.PickerEmptyHint),
                    browseCatalogLabel: t(CatalogI18nKeys.PickerBrowseCatalog),
                    removeFromFavoritesLabel: t(
                      CatalogI18nKeys.PickerRemoveFromFavorites,
                    ),
                  }}
                />
              </Suspense>
            )}
          />
          <StarterButtons starters={starters} onSelect={handleStarterSelect} />
        </div>
        {isDialFileManagerOpen && (
          <DialFileManagerModal
            isOpen={isDialFileManagerOpen}
            onClose={closeDialFileManager}
            onAttach={handleAttachDialFiles}
            bucket={bucket}
            allowedTypes={inputAttachmentTypes}
            maxSelectableFileSize={MAX_SELECTABLE_FILE_SIZE_BYTES}
            maximumAttachmentsAmount={selectedDeployment?.maxInputAttachments}
            canAttachFolders={selectedDeployment?.features?.folderAttachments}
            title={t(DialFileManagerI18nKeys.Title)}
            attachLabel={t(DialFileManagerI18nKeys.Attach)}
            emptyTitle={t(DialFileManagerI18nKeys.Empty)}
            emptyDescription=""
            errorMessage={t(DialFileManagerI18nKeys.Error)}
            retryLabel={t(DialFileManagerI18nKeys.Retry)}
            hiddenFilesLabel={t(DialFileManagerI18nKeys.HiddenFiles)}
            showHiddenFilesLabel={t(DialFileManagerI18nKeys.ShowHiddenFiles)}
            hideHiddenFilesLabel={t(DialFileManagerI18nKeys.HideHiddenFiles)}
            getSelectionLabel={(count) =>
              t(DialFileManagerI18nKeys.ItemsSelected, { count })
            }
            uploadFilesLabel={t(DialFileManagerI18nKeys.Upload)}
            newFolderLabel={t(DialFileManagerI18nKeys.NewFolder)}
            downloadLabel={t(DialFileManagerI18nKeys.Download)}
            downloadingLabel={t(DialFileManagerI18nKeys.Downloading)}
            deleteLabel={t(DialFileManagerI18nKeys.DeleteAction)}
            deletingLabel={t(DialFileManagerI18nKeys.DeletingLabel)}
            deleteConfirmTitle={(names) =>
              names.length === 1
                ? t(DialFileManagerI18nKeys.DeleteConfirmTitleSingle)
                : t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple)
            }
            deleteConfirmBody={(names) => (
              <div className="px-6 py-3 text-sm">
                <p className="mb-3 text-secondary">
                  {names.length === 1 ? (
                    <>
                      {t(DialFileManagerI18nKeys.DeleteConfirmBodySingle)}{' '}
                      <span className="break-all text-primary">
                        &quot;{names[0].split('/').pop()}&quot;?
                      </span>
                    </>
                  ) : (
                    <>
                      {t(DialFileManagerI18nKeys.DeleteConfirmBodyMultiple)}{' '}
                      <span className="text-primary">
                        {names.length}{' '}
                        {t(DialFileManagerI18nKeys.DeleteConfirmBodyItems)}
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
            deleteConfirmLabel={t(DialFileManagerI18nKeys.DeleteConfirmButton)}
            deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
            uploadProgressTitle={t(DialFileManagerI18nKeys.UploadProgressTitle)}
            cancelLabel={t(ButtonsI18nKeys.Cancel)}
          />
        )}
        <Suspense fallback={null}>
          <CatalogPickerModal
            isOpen={isCatalogPickerOpen}
            onClose={() => setIsCatalogPickerOpen(false)}
          />
        </Suspense>
      </Suspense>
    </div>
  );
};

export default memo(ConversationRoute);
