import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import {
  AttachmentErrorReason,
  isAudioTranscriptionSupported,
  ResponseFormat,
} from '@epam/ai-dial-chat-shared';
import {
  FileDndOverlay,
  type ChatSettingsValues,
} from '@epam/ai-dial-conversation-input';
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
import { getConversationRoute } from '../../constants/routes';
import {
  AttachmentsI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ChatSettingsI18nKeys,
  ConversationI18nKeys,
  DeploymentsI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
} from '../../constants/translation-keys';
import { NETWORK_ERROR_DEBOUNCE_MS } from '../../constants/upload';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useAttachmentValidation } from '../../hooks/attachment/useAttachmentValidation';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useDialFileManagerState } from '../../hooks/files/useDialFileManagerState';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import { getApiErrorMessage } from '../../server-api/api-error';
import {
  transcribeAudio,
  transcribeAudioWithAsrModel,
} from '../../server-api/chat.api';
import {
  createConversation as apiCreateConversation,
  saveConversation,
} from '../../server-api/conversations.api';
import { uploadFile } from '../../server-api/files.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { buildUploadPath } from '../../utils/build-upload-path';
import { getConversationPath } from '../../utils/conversation-path';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import {
  getLastConversationSettings,
  setLastConversationSettings,
} from '../../utils/local-storage';
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

// TODO: rename page and component
// TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const [chatSettingsValues, setChatSettingsValues] = useState(() => {
    const saved = getLastConversationSettings();
    return {
      responseFormat:
        (saved?.responseFormat as ResponseFormat | undefined) ??
        ResponseFormat.Markdown,
      systemPrompt: '',
      temperature: saved?.temperature ?? 0.5,
    };
  });
  const { showNotification } = useNotification();
  const { asrModelId, transcribeSizeLimitBytes } = useAppConfig();
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

  const { inputAttachmentTypes, isAttachmentsAllowed, validateAttachment } =
    useAttachmentValidation(selectedDeployment);

  const pendingNetworkFilesRef = useRef<string[]>([]);
  const networkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const chatSettings = useMemo(
    () => ({
      features: {
        ...(selectedDeployment?.features ?? {
          systemPrompt: false,
          temperature: false,
        }),
        responseFormat: true,
      },
      responseFormat: chatSettingsValues.responseFormat,
      systemPrompt: chatSettingsValues.systemPrompt,
      temperature: chatSettingsValues.temperature,
      onSave: (values: ChatSettingsValues) =>
        setChatSettingsValues((prev) => ({
          responseFormat: values.responseFormat ?? prev.responseFormat,
          systemPrompt: values.systemPrompt ?? prev.systemPrompt,
          temperature: values.temperature ?? prev.temperature,
        })),
      menuItemLabel: t(ChatI18nKeys.ChatSettings),
      title: t(ChatSettingsI18nKeys.Title),
      responseFormatLabel: t(ChatSettingsI18nKeys.ResponseFormatLabel),
      responseFormatHint: t(ChatSettingsI18nKeys.ResponseFormatHint),
      responseFormatMarkdownLabel: t(
        ChatSettingsI18nKeys.ResponseFormatMarkdown,
      ),
      responseFormatPlainTextLabel: t(
        ChatSettingsI18nKeys.ResponseFormatPlainText,
      ),
      systemPromptLabel: t(ChatSettingsI18nKeys.SystemPromptLabel),
      systemPromptTooltip: t(ChatSettingsI18nKeys.SystemPromptTooltip),
      temperatureLabel: t(ChatSettingsI18nKeys.TemperatureLabel),
      temperatureLabels: [
        t(ChatSettingsI18nKeys.TemperaturePrecise),
        t(ChatSettingsI18nKeys.TemperatureNeutral),
        t(ChatSettingsI18nKeys.TemperatureCreative),
      ] as [string, string, string],
      temperatureHint: t(ChatSettingsI18nKeys.TemperatureHint),
      saveLabel: t(ChatSettingsI18nKeys.SaveLabel),
    }),
    [selectedDeployment?.features, chatSettingsValues, t],
  );

  const modelSelectorLabels = useMemo(
    () => ({
      ariaLabel: t(DeploymentsI18nKeys.SelectorAriaLabel),
      loading: isLoading ? t(DeploymentsI18nKeys.SelectorLoading) : undefined,
      error: error ? t(DeploymentsI18nKeys.SelectorError) : undefined,
      empty:
        !isLoading && !error && items.length === 0
          ? t(DeploymentsI18nKeys.SelectorEmpty)
          : undefined,
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      closeLabel: t(DeploymentsI18nKeys.SelectorCloseLabel),
    }),
    [t, isLoading, error, items.length],
  );

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
        await saveConversation(getConversationPath(conversation.id), {
          ...conversation,
          prompt: chatSettingsValues.systemPrompt,
          temperature: chatSettingsValues.temperature,
          responseFormat: chatSettingsValues.responseFormat,
        } as ConversationResponseDto);
        setLastConversationSettings({
          temperature: chatSettingsValues.temperature,
          responseFormat: chatSettingsValues.responseFormat,
        });
        navigate(getConversationRoute(conversation.id));
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

  const handleUploadAttachment = useCallback(
    async (attachment: Attachment): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      try {
        const response = await uploadFile(
          bucket,
          buildUploadPath(attachment),
          attachment.file,
        );
        return response.url;
      } catch (err) {
        if (!navigator.onLine) {
          pendingNetworkFilesRef.current.push(attachment.name);
          if (networkTimerRef.current != null) {
            clearTimeout(networkTimerRef.current);
          }
          networkTimerRef.current = setTimeout(() => {
            const filenames = pendingNetworkFilesRef.current.splice(0);
            showNotification({
              variant: NotificationVariant.Error,
              title: t(AttachmentsI18nKeys.NetworkErrorTitle),
              message: (
                <div className="min-w-0 overflow-hidden">
                  <span className="whitespace-pre-line">
                    {t(AttachmentsI18nKeys.NetworkErrorMessage)}
                  </span>
                  <ul className="mt-1 max-w-[508px]">
                    {filenames.map((name, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-1 overflow-hidden"
                      >
                        <span className="shrink-0" aria-hidden>
                          •
                        </span>
                        <span className="min-w-0 flex-1 truncate">{name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            });
            networkTimerRef.current = null;
          }, NETWORK_ERROR_DEBOUNCE_MS);
          const error =
            err instanceof Error ? err : new Error('Network upload failed');
          (
            error as Error & { errorReason: AttachmentErrorReason }
          ).errorReason = AttachmentErrorReason.Network;
          throw error;
        }
        throw err;
      }
    },
    [bucket, showNotification, t],
  );

  const lastAudioMimeTypeRef = useRef<string>('audio/webm');

  const handleUploadAudio = useCallback(
    async (file: File, contentType: string): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }
      if (file.size > transcribeSizeLimitBytes) {
        throw new Error(
          `Audio file exceeds the ${transcribeSizeLimitBytes} byte limit`,
        );
      }
      lastAudioMimeTypeRef.current = contentType;
      const response = await uploadFile(
        bucket,
        buildUploadPath({ name: file.name } as Attachment),
        file,
      );
      return response.url;
    },
    [bucket, transcribeSizeLimitBytes],
  );

  const handleTranscribeAudio = useCallback(
    async (audioUrl: string): Promise<string> => {
      const mimeType = lastAudioMimeTypeRef.current;
      if (asrModelId != null) {
        return transcribeAudioWithAsrModel({ audioUrl, mimeType });
      }
      if (!selectedItemId) {
        throw new Error('No model selected');
      }
      return transcribeAudio({
        audioUrl,
        mimeType,
        deployment: selectedItemId,
      });
    },
    [asrModelId, selectedItemId],
  );

  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();

  const isTranscriptionSupported = useMemo(() => {
    if (asrModelId != null) return true;
    const selectedItem = items.find((item) => item.id === selectedItemId);
    return isAudioTranscriptionSupported(selectedItem?.inputAttachmentTypes);
  }, [asrModelId, items, selectedItemId]);

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
          className="flex h-full flex-col items-center justify-center p-4 desktop:p-8"
          role="region"
          aria-label={t(ChatI18nKeys.WelcomeScreen)}
        >
          <ConversationInput
            onSend={handleSend}
            onUploadAttachment={handleUploadAttachment}
            message={inputMessage}
            welcomeText={t(ChatI18nKeys.WelcomeText)}
            placeholder={t(ChatI18nKeys.Placeholder)}
            styles={{ typography: { welcomeClassName: 'dial-display2-text' } }}
            deployments={deploymentItems}
            selectedDeploymentId={selectedItemId}
            onDeploymentChange={setSelectedItemId}
            isInputDisabled={isInputDisabled}
            modelSelectorLabels={modelSelectorLabels}
            sendLabel={t(ChatI18nKeys.SendMessage)}
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
      </Suspense>
    </div>
  );
};

export default memo(ConversationRoute);
