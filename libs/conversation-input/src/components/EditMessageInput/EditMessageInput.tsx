import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { RequestStatus, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialNeutralButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';
import { ChangeEvent, type FC, useCallback, useRef, useState } from 'react';
import type { EditMessageInputProps } from '../../models/ConversationInput.js';
import { AddAttachmentButton } from '../AddAttachmentButton/AddAttachmentButton.js';
import { AttachmentTray } from '../AttachmentTray/AttachmentTray.js';
import { Input } from '../Input/Input.js';

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
  addMenuLabel = 'Add',
  attachLabel = 'Attach file',
  menuTitle = 'Menu',
  menuCloseLabel = 'Close',
  className,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[]>([]);
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
    if (canSend) {
      handleSend(currentText, currentNewAttachments);
    }
  };

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    setPendingDropFiles(files);
  }, []);

  return (
    <div className={mergeClasses('flex w-full flex-col gap-2', className)}>
      {keptAttachments.length > 0 && (
        <AttachmentTray
          attachments={keptAttachments}
          onRemove={handleRemovePreExisting}
          removeLabel={removeLabel}
        />
      )}

      {/* Bordered box — contains only the textarea (and new attachment tray) */}
      <Input
        message={message}
        ariaLabel={ariaLabel}
        isStacked
        hideActionBar
        pendingDropFiles={pendingDropFiles}
        onDropFilesConsumed={() => setPendingDropFiles([])}
        onSend={handleSend}
        onUploadAttachment={onUploadAttachment}
        onChange={setCurrentText}
        onAttachmentsChange={setCurrentNewAttachments}
        removeLabel={removeLabel}
        retryLabel={retryLabel}
        className="max-w-full"
      />

      {/* Action row — outside the bordered box */}
      <div className="flex items-center justify-between">
        <div className="flex">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={handleFileChange}
          />
          <AddAttachmentButton
            onAttachClick={() => fileInputRef.current?.click()}
            attachLabel={attachLabel}
            addMenuLabel={addMenuLabel}
            menuTitle={menuTitle}
            menuCloseLabel={menuCloseLabel}
          />
        </div>

        <div className="flex gap-2">
          <DialNeutralButton label={cancelLabel} onClick={onCancel} />
          <DialPrimaryButton
            label={saveLabel}
            onClick={handleSaveClick}
            disabled={!canSend}
          />
        </div>
      </div>
    </div>
  );
};
