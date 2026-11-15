import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconFile } from '@tabler/icons-react';
import { type CSSProperties, type RefObject, useMemo } from 'react';
import { VoiceRecordingMode } from '../../hooks/useVoiceRecorder';
import type { ChatSettingsConfig, MenuOverlayConfig } from '../../models/Input';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton';
import type { useVoiceInput } from './hooks/useVoiceInput';

interface InputAttachButtonProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  message: string;
  style: CSSProperties;
  hideAttachFile: boolean | undefined;
  isInputDisabled: boolean;
  isStreaming: boolean;
  isAttachmentsEnabled: boolean;
  isVoiceRecordingSupported: boolean | undefined;
  isVoiceActive: boolean;
  startRecording: ReturnType<typeof useVoiceInput>['startRecording'];
  isPhone: boolean;
  canRemoveTools: boolean;
  toolsMenuItems: ToolMenuItem[] | undefined;
  onToolToggle: ((toolId: string) => void) | undefined;
  chatSettings: ChatSettingsConfig | undefined;
  menuOverlays: MenuOverlayConfig[] | undefined;
  onDialFileSystemClick: (() => void) | undefined;
  dialFileSystemLabel: string | undefined;
  attachLabel: string;
  addMenuTitle: string;
  menuTitle: string;
  menuCloseLabel: string;
  recordVoiceLabel: string | undefined;
  toolsMenuTitle: string | undefined;
  toolsBackLabel: string | undefined;
}

/**
 * The `+` attach button of `Input` with its menu: file upload, the DIAL
 * file system entry, voice recording as an attachment, chat settings and the
 * tools submenu. Private to `Input`.
 *
 * Shared between the normal footer and the voice bar's second row: same
 * menu, same file input, only its disabled state differs. Disabled while
 * a dictation/attachment recording is anything but actively Recording, so
 * it cannot be used to interrupt a pending transcription.
 */
export const InputAttachButton = ({
  fileInputRef,
  textareaRef,
  message,
  style,
  hideAttachFile,
  isInputDisabled,
  isStreaming,
  isAttachmentsEnabled,
  isVoiceRecordingSupported,
  isVoiceActive,
  startRecording,
  isPhone,
  canRemoveTools,
  toolsMenuItems,
  onToolToggle,
  chatSettings,
  menuOverlays,
  onDialFileSystemClick,
  dialFileSystemLabel,
  attachLabel,
  addMenuTitle,
  menuTitle,
  menuCloseLabel,
  recordVoiceLabel,
  toolsMenuTitle,
  toolsBackLabel,
}: InputAttachButtonProps) => {
  const dialFileSystemMenuItem = useMemo(
    () =>
      onDialFileSystemClick
        ? [
            {
              key: 'dial-fs',
              label: dialFileSystemLabel ?? 'DIAL file system',
              icon: (
                <IconFile
                  size={BASE_ICON_SIZE}
                  aria-hidden
                  stroke={DIAL_KIT_ICON_STROKE}
                />
              ),
              onClick: onDialFileSystemClick,
            },
          ]
        : [],
    [onDialFileSystemClick, dialFileSystemLabel],
  );

  return (
    <AddAttachmentButton
      onAttachClick={
        hideAttachFile ? undefined : () => fileInputRef.current?.click()
      }
      attachLabel={attachLabel}
      addMenuTitle={addMenuTitle}
      menuTitle={menuTitle}
      menuCloseLabel={menuCloseLabel}
      style={style}
      isDisabled={isInputDisabled || isVoiceActive}
      chatSettings={chatSettings}
      extraMenuItems={dialFileSystemMenuItem}
      onRecordVoice={
        isVoiceRecordingSupported &&
        isAttachmentsEnabled &&
        !isStreaming &&
        !isVoiceActive
          ? () => startRecording(VoiceRecordingMode.Attachment)
          : undefined
      }
      recordVoiceLabel={recordVoiceLabel}
      /*
       * The "Tools" submenu exists only to bring a dismissed chip
       * back. With removal off every chip is always on screen, so the
       * entry would be dead weight — and where tools are the menu's
       * only content, withholding them drops the `+` button entirely.
       * On a phone unselected tools have no chip, so the submenu is the
       * only way to switch them on and is always offered.
       */
      toolsMenuItems={canRemoveTools || isPhone ? toolsMenuItems : undefined}
      onToolToggle={onToolToggle}
      toolsMenuTitle={toolsMenuTitle}
      toolsBackLabel={toolsBackLabel}
      menuOverlays={menuOverlays}
      getCaretPosition={() =>
        textareaRef.current?.selectionStart ?? message.length
      }
    />
  );
};
