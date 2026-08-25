import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { RequestStatus, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  NeutralButton,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconFile } from '@tabler/icons-react';
import {
  ChangeEvent,
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { EditMessageInputProps } from '../../models/ConversationInput';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton';
import { Input } from '../Input/Input';

/** Inline edit-message form: pre-populated textarea, existing attachment tray, and Save/Cancel actions. */
export const EditMessageInput: FC<EditMessageInputProps> = ({
  message,
  initialAttachments = [],
  onCancel,
  onSave,
  onUploadAttachment,
  cancelLabel = 'Cancel',
  saveLabel = 'Save & Submit',
  ariaLabel,
  removeLabel,
  retryLabel,
  addMenuTitle = 'Add',
  attachLabel = 'Attach file',
  menuTitle = 'Menu',
  menuCloseLabel = 'Close',
  className,
  pendingDropFiles: externalPendingFiles,
  onDropFilesConsumed,
  validateAttachment,
  isAttachmentsEnabled,
  hideAttachFile = false,
  fileAccept,
  maximumAttachmentsAmount,
  onAttachmentsLimitExceeded,
  onDialFileSystemClick,
  dialFileSystemLabel,
  pendingAttachments,
  onPendingAttachmentsConsumed,
  onAttachmentClick,
  pasteTextThreshold,
  maxMessageLength = 50000,
  onMessageTooLong,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!externalPendingFiles?.length) return;
    setPendingDropFiles(externalPendingFiles);
    onDropFilesConsumed?.();
  }, [externalPendingFiles, onDropFilesConsumed]);
  const [currentText, setCurrentText] = useState(message ?? '');
  const [currentNewAttachments, setCurrentNewAttachments] = useState<
    Attachment[]
  >([]);
  const [keptAttachments, setKeptAttachments] =
    useState<DisplayAttachment[]>(initialAttachments);

  const hasBlockedNewAttachments = currentNewAttachments.some(
    (attachment) =>
      attachment.status === RequestStatus.Loading ||
      attachment.status === RequestStatus.Error,
  );
  const canSend =
    (currentText.trim().length > 0 ||
      currentNewAttachments.length > 0 ||
      keptAttachments.length > 0) &&
    !hasBlockedNewAttachments;

  const handleRemovePreExisting = (id: string) => {
    setKeptAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Called by Input's Enter-key path and by the external Save button.
  const handleSend = useCallback(
    (text: string, newAttachments: Attachment[]) => {
      onSave(text, keptAttachments, newAttachments);
    },
    [keptAttachments, onSave],
  );

  const handleSaveClick = () => {
    if (!canSend) return;
    if (!isAttachmentsEnabled && currentText.length >= maxMessageLength) {
      onMessageTooLong?.(currentText.length, maxMessageLength);
      return;
    }
    handleSend(currentText, currentNewAttachments);
  };

  const handleDropFilesConsumed = useCallback(
    () => setPendingDropFiles([]),
    [],
  );

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    setPendingDropFiles(files);
  }, []);

  const dialFileSystemMenuItem = useMemo(
    () =>
      onDialFileSystemClick
        ? [
            {
              key: 'dial-fs',
              label: dialFileSystemLabel ?? 'DIAL file system',
              icon: <IconFile size={BASE_ICON_SIZE} aria-hidden />,
              onClick: onDialFileSystemClick,
            },
          ]
        : [],
    [onDialFileSystemClick, dialFileSystemLabel],
  );

  return (
    <div className={mergeClasses('flex w-full flex-col gap-2', className)}>
      {/* Bordered box — contains kept attachments, new attachments, and the textarea */}
      <Input
        message={message}
        ariaLabel={ariaLabel}
        isStacked
        hideActionBar
        pendingDropFiles={pendingDropFiles}
        onDropFilesConsumed={handleDropFilesConsumed}
        onSend={handleSend}
        onUploadAttachment={onUploadAttachment}
        onChange={setCurrentText}
        onAttachmentsChange={setCurrentNewAttachments}
        removeLabel={removeLabel}
        retryLabel={retryLabel}
        className="max-w-full"
        prefixAttachments={keptAttachments}
        onRemovePrefixAttachment={handleRemovePreExisting}
        validateAttachment={validateAttachment}
        isAttachmentsEnabled={isAttachmentsEnabled}
        maximumAttachmentsAmount={maximumAttachmentsAmount}
        onAttachmentsLimitExceeded={onAttachmentsLimitExceeded}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsConsumed={onPendingAttachmentsConsumed}
        onAttachmentClick={onAttachmentClick}
        pasteTextThreshold={pasteTextThreshold}
        maxMessageLength={maxMessageLength}
        onMessageTooLong={onMessageTooLong}
      />

      {/* Action row — outside the bordered box */}
      <div className="flex items-center justify-between">
        <div className="flex">
          {!hideAttachFile && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={fileAccept}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={handleFileChange}
              />
              <AddAttachmentButton
                onAttachClick={() => fileInputRef.current?.click()}
                attachLabel={attachLabel}
                addMenuTitle={addMenuTitle}
                menuTitle={menuTitle}
                menuCloseLabel={menuCloseLabel}
                extraMenuItems={dialFileSystemMenuItem}
              />
            </>
          )}
        </div>

        <div className="flex gap-2">
          <NeutralButton label={cancelLabel} onClick={onCancel} />
          <PrimaryButton
            label={saveLabel}
            onClick={handleSaveClick}
            disabled={!canSend}
          />
        </div>
      </div>
    </div>
  );
};
