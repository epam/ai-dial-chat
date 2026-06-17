import type {
  Attachment,
  DeploymentItem,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import { isAudioTranscriptionSupported } from '@epam/ai-dial-chat-shared';
import { FileDndOverlay } from '@epam/ai-dial-conversation-input';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
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
import { getConversationRoute } from '../../constants/routes';
import {
  BasicI18nKeys,
  ChatI18nKeys,
  DeploymentsI18nKeys,
  FileDndI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useKeyboardShortcutPreference } from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import { getApiErrorMessage } from '../../server-api/api-error';
import {
  transcribeAudio,
  transcribeAudioWithAsrModel,
} from '../../server-api/chat.api';
import { createConversation as apiCreateConversation } from '../../server-api/conversations.api';
import { uploadFile } from '../../server-api/files.api';
import { attachmentsToDtos } from '../../utils/attachment-to-dto';
import { buildUploadPath } from '../../utils/build-upload-path';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import {
  getStarterPopulateText,
  getStartersFromSchema,
} from '../../utils/starter-option';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

// TODO: rename page and component
// TODO: review component after ConversationPage implementation, maybe move ConversationInput here and remove ConversationInput component
const ConversationRoute: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSending, setIsSending] = useState(false);
  const [inputMessage, setInputMessage] = useState<string | undefined>();
  const { showNotification } = useNotification();
  const { asrModelId, transcribeSizeLimitBytes } = useAppConfig();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const inputRef = useRef<HTMLDivElement>(null);
  const {
    items,
    selectedItemId,
    setSelectedItemId,
    selectedDeploymentConfiguration,
    isLoading,
    error,
  } = useDeployments();

  const isAttachmentsAllowed = useMemo(() => {
    const selectedItem = items.find((item) => item.id === selectedItemId);
    const types = selectedItem?.inputAttachmentTypes;
    return types != null && types.length > 0;
  }, [items, selectedItemId]);

  const { isDragging, pendingFiles, onFilesConsumed } =
    usePageFileDrag(isAttachmentsAllowed);

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
    [navigate, isSending, selectedItemId, showNotification, t],
  );

  const handleUploadAttachment = useCallback(
    async (attachment: Attachment): Promise<string> => {
      if (!bucket) {
        throw new Error('User bucket is not available');
      }

      const response = await uploadFile(
        bucket,
        buildUploadPath(attachment),
        attachment.file,
      );
      return response.url;
    },
    [bucket],
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
            pendingDropFiles={pendingFiles}
            onDropFilesConsumed={onFilesConsumed}
            autoFocus={!isMobile}
          />
          <StarterButtons starters={starters} onSelect={handleStarterSelect} />
        </div>
      </Suspense>
    </div>
  );
};

export default memo(ConversationRoute);
