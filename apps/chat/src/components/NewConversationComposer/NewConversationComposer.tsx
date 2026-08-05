import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import {
  ResponseFormat,
  type Attachment,
  type DeploymentItem,
  type DisplayAttachment,
  type ToolMenuItem,
} from '@epam/ai-dial-chat-shared';
import {
  FileDndOverlay,
  type ConversationInputStyles,
  type ToolsChipLabels,
} from '@epam/ai-dial-conversation-input';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import type { FC, ReactNode } from 'react';
import { lazy, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_SELECTABLE_FILE_SIZE_BYTES } from '../../constants/files';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ChatI18nKeys,
  ConversationI18nKeys,
  ConversationInputI18nKeys,
  DialFileManagerI18nKeys,
  FileDndI18nKeys,
  VoiceRecordingI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
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
import { usePageFileDrag } from '../../hooks/usePageFileDrag';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getApiErrorMessage } from '../../server-api/api-error';
import { buildNetworkUploadErrorNotification } from '../../utils/attachment-network-error-notification';
import { getTimeOfDayGreeting } from '../../utils/greeting';
import FooterMessage from '../FooterMessage/FooterMessage';
import UsageLimitsControl from '../UsageLimitsControl/UsageLimitsControl';

const ConversationInput = lazy(async () => {
  const module = await import('@epam/ai-dial-conversation-input');
  return { default: module.ConversationInput };
});

const DialFileManagerModal = lazy(async () => {
  const module = await import('../DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

/** Local (not-yet-persisted) chat settings collected before a conversation exists. */
export interface NewConversationChatSettings {
  responseFormat: ResponseFormat;
  systemPrompt: string;
  temperature: number;
}

interface Props {
  /** Deployment list for the model selector menu. Pass a single fixed item to pin the model. */
  deployments: DeploymentItem[];
  selectedDeploymentId: string | null;
  /** Omit (or pass `undefined`) to pin the model — the selector then renders disabled via `isModelSelectorDisabled`. */
  onDeploymentChange?: (id: string) => void;
  isModelSelectorDisabled?: boolean;
  modelPickerOverlay?: (onClose: () => void) => ReactNode;
  /** Backs attachment/audio-transcription validation and chat-settings feature gating. */
  selectedDeployment?: DeploymentItemDto;
  isModelSelectorLoading?: boolean;
  modelSelectorError?: unknown;
  isInputDisabled?: boolean;
  placeholder: string;
  /** Optional text shown below the composer input and above starter buttons. */
  introText?: string;
  /** Initial textarea content (e.g. populated by a starter selection). */
  message?: string;
  inputStyles?: ConversationInputStyles;
  /** Called on first send. Rejecting shows the standard create-conversation error notification. */
  onCreateConversation: (
    message: string,
    attachments: Attachment[],
    chatSettings: NewConversationChatSettings,
  ) => Promise<void>;
  toolsMenuItems?: ToolMenuItem[];
  onToolToggle?: (toolId: string) => void;
  toolsMenuTitle?: string;
  toolsChipLabels?: ToolsChipLabels;
  /** Rendered below the composer input (e.g. starter buttons). */
  children?: ReactNode;
}

const NewConversationComposer: FC<Props> = ({
  deployments,
  selectedDeploymentId,
  onDeploymentChange,
  isModelSelectorDisabled = false,
  modelPickerOverlay,
  selectedDeployment,
  isModelSelectorLoading = false,
  modelSelectorError = null,
  isInputDisabled = false,
  placeholder,
  introText,
  message,
  inputStyles,
  onCreateConversation,
  toolsMenuItems,
  onToolToggle,
  toolsMenuTitle,
  toolsChipLabels,
  children,
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';

  const [isSending, setIsSending] = useState(false);
  const [attachmentsAmount, setAttachmentsAmount] = useState(0);
  const [chatSettingsValues, setChatSettingsValues] =
    useState<NewConversationChatSettings>({
      responseFormat: ResponseFormat.Markdown,
      systemPrompt: '',
      temperature: 0.5,
    });

  const {
    isOpen: isDialFileManagerOpen,
    openModal: openDialFileManager,
    closeModal: closeDialFileManager,
    pendingAttachments: pendingDialAttachments,
    clearPendingAttachments: clearPendingDialAttachments,
    handleAttach: handleAttachDialFiles,
  } = useDialFileManagerState(bucket);

  const {
    inputAttachmentTypes,
    isAttachmentsAllowed,
    validateAttachment,
    fileAccept,
  } = useAttachmentValidation(selectedDeployment);

  const handleNetworkUploadError = useCallback(
    (filenames: string[]) => {
      const { title, message: notificationMessage } =
        buildNetworkUploadErrorNotification(filenames, t);
      showNotification({
        variant: NotificationVariant.Error,
        title,
        message: notificationMessage,
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

  const { isAudioMessageSupported } = useAudioTranscription({
    selectedDeploymentId,
  });

  const chatSettings = useChatSettingsFormConfig({
    mode: 'local',
    values: chatSettingsValues,
    onValuesChange: setChatSettingsValues,
    deploymentFeatures: selectedDeployment?.features,
  });

  const modelSelectorLabels = useModelSelectorLabels({
    isLoading: isModelSelectorLoading,
    error: modelSelectorError,
    itemCount: deployments.length,
  });

  const isMobile = useIsMobile();
  const { preference: sendOnEnter } = useKeyboardShortcutPreference();
  const isEmptyChatSettingsEnabled = useUiFeature(
    OverlayFeature.EmptyChatSettings,
  );
  const isHideEmptyChatChangeAgentEnabled = useUiFeature(
    OverlayFeature.HideEmptyChatChangeAgent,
  );
  const isDisabledSendEnabled = useUiFeature(OverlayFeature.DisabledSend);
  const isSkipFocusChatInputOnloadEnabled = useUiFeature(
    OverlayFeature.SkipFocusChatInputOnload,
  );
  const isInputFilesEnabled = useUiFeature(OverlayFeature.InputFiles);
  const { displayName } = useUserProfile();
  const firstName = displayName.split(' ')[0];
  const { openAttachmentCanvas } = useOpenAttachmentCanvas();

  const usageLimitsLabels = useMemo(
    () => ({
      triggerAriaLabel: ({ value }: { value: string }) =>
        t(ConversationInputI18nKeys.TriggerAriaLabel, { value }),
      popoverTitle: t(ConversationInputI18nKeys.PopoverTitle),
      error: t(ConversationInputI18nKeys.Error),
      tokensRemaining: ({ count }: { count: string }) =>
        t(ConversationInputI18nKeys.TokensRemaining, { count }),
      progressAriaLabel: ({ used, total }: { used: string; total: string }) =>
        t(ConversationInputI18nKeys.ProgressAriaLabel, { used, total }),
    }),
    [t],
  );

  const handleAttachmentClick = useCallback(
    (attachment: DisplayAttachment) => {
      void openAttachmentCanvas(attachment);
    },
    [openAttachmentCanvas],
  );

  const handleAttachmentsChange = useCallback((attachments: Attachment[]) => {
    setAttachmentsAmount(attachments.length);
  }, []);

  const handleAttachmentsLimitExceeded = useCallback(
    (count: number, limit: number) => {
      showNotification({
        variant: NotificationVariant.Error,
        title: t(DialFileManagerI18nKeys.TooManyFilesSelected),
        message: t(DialFileManagerI18nKeys.TooManyFilesDescription, {
          count,
          limit,
        }),
      });
    },
    [showNotification, t],
  );

  const handleMessageTooLong = useCallback(
    (_length: number, max: number) => {
      showNotification({
        variant: NotificationVariant.Error,
        message: t(ConversationI18nKeys.MessageTooLong, { max }),
      });
    },
    [showNotification, t],
  );

  const handleSend = useCallback(
    async (text: string, attachments: Attachment[]) => {
      if (isSending || !selectedDeploymentId) return;
      setIsSending(true);
      try {
        await onCreateConversation(text, attachments, chatSettingsValues);
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
      isSending,
      selectedDeploymentId,
      onCreateConversation,
      chatSettingsValues,
      showNotification,
      t,
    ],
  );

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <FileDndOverlay
        isVisible={isDragging}
        isAttachmentsAllowed={isAttachmentsAllowed}
        labels={{
          title: t(
            isAttachmentsAllowed
              ? BasicI18nKeys.AttachFiles
              : FileDndI18nKeys.OverlayDeniedTitle,
          ),
          subtitle: t(
            isAttachmentsAllowed
              ? FileDndI18nKeys.OverlaySubtitle
              : FileDndI18nKeys.OverlayDeniedSubtitle,
          ),
        }}
      />
      <div
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4 [container-type:inline-size] desktop:p-8"
        role="region"
        aria-label={t(ChatI18nKeys.WelcomeScreen)}
      >
        <ConversationInput
          onSend={handleSend}
          onUploadAttachment={handleUploadAttachment}
          onAttachmentsChange={handleAttachmentsChange}
          message={message}
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
          placeholder={placeholder}
          styles={inputStyles}
          deployments={
            isHideEmptyChatChangeAgentEnabled ? undefined : deployments
          }
          selectedDeploymentId={selectedDeploymentId}
          onDeploymentChange={onDeploymentChange}
          isInputDisabled={isInputDisabled}
          isModelSelectorDisabled={isModelSelectorDisabled}
          isSendDisabled={isDisabledSendEnabled}
          modelSelectorLabels={modelSelectorLabels}
          addMenuTitle={t(ConversationI18nKeys.AddMenuTitle)}
          sendLabel={t(ChatI18nKeys.SendMessage)}
          sendTitle={t(ChatI18nKeys.SendMessage)}
          stopLabel={t(ChatI18nKeys.StopStreaming)}
          isAudioMessageSupported={isAudioMessageSupported}
          micLabel={t(VoiceRecordingI18nKeys.MicLabel)}
          stopRecordingLabel={t(VoiceRecordingI18nKeys.StopRecordingLabel)}
          discardRecordingLabel={t(
            VoiceRecordingI18nKeys.DiscardRecordingLabel,
          )}
          timerAriaLabel={t(VoiceRecordingI18nKeys.TimerAriaLabel)}
          sendOnEnter={sendOnEnter}
          chatSettings={isEmptyChatSettingsEnabled ? chatSettings : undefined}
          pendingDropFiles={pendingFiles}
          onDropFilesConsumed={onFilesConsumed}
          pendingAttachments={pendingDialAttachments}
          onPendingAttachmentsConsumed={clearPendingDialAttachments}
          autoFocus={!isMobile && !isSkipFocusChatInputOnloadEnabled}
          onDialFileSystemClick={
            isAttachmentsAllowed ? openDialFileManager : undefined
          }
          dialFileSystemLabel={t(ConversationI18nKeys.AttachMenuDialFileSystem)}
          validateAttachment={
            selectedDeployment != null ? validateAttachment : undefined
          }
          isAttachmentsEnabled={
            selectedDeployment != null ? isAttachmentsAllowed : undefined
          }
          maximumAttachmentsAmount={selectedDeployment?.maxInputAttachments}
          onAttachmentsLimitExceeded={handleAttachmentsLimitExceeded}
          hideAttachFile={!isAttachmentsAllowed || !isInputFilesEnabled}
          fileAccept={fileAccept}
          onAttachmentClick={handleAttachmentClick}
          onMessageTooLong={handleMessageTooLong}
          modelPickerOverlay={modelPickerOverlay}
          toolsMenuItems={toolsMenuItems}
          onToolToggle={onToolToggle}
          toolsMenuTitle={toolsMenuTitle}
          toolsChipLabels={toolsChipLabels}
          usageLimitsSlot={
            <UsageLimitsControl
              deploymentId={selectedDeploymentId ?? undefined}
              labels={usageLimitsLabels}
            />
          }
        />
        {introText && (
          <p className="dial-small-text mb-4 mt-4 max-w-3xl text-center text-secondary">
            {introText}
          </p>
        )}
        {children}
      </div>
      <FooterMessage />
      {isDialFileManagerOpen && (
        <DialFileManagerModal
          isOpen={isDialFileManagerOpen}
          onClose={closeDialFileManager}
          onAttach={handleAttachDialFiles}
          bucket={bucket}
          allowedTypes={inputAttachmentTypes}
          maxSelectableFileSize={MAX_SELECTABLE_FILE_SIZE_BYTES}
          maximumAttachmentsAmount={selectedDeployment?.maxInputAttachments}
          existingAttachmentsAmount={attachmentsAmount}
          canAttachFolders={selectedDeployment?.features?.folderAttachments}
          title={t(BasicI18nKeys.AttachFiles)}
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
          downloadLabel={t(ButtonsI18nKeys.Download)}
          downloadingLabel={t(DialFileManagerI18nKeys.Downloading)}
          deleteLabel={t(ButtonsI18nKeys.Delete)}
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
                    {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
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
          deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
          deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
          uploadProgressTitle={t(DialFileManagerI18nKeys.UploadProgressTitle)}
          cancelLabel={t(ButtonsI18nKeys.Cancel)}
        />
      )}
    </div>
  );
};

export default memo(NewConversationComposer);
