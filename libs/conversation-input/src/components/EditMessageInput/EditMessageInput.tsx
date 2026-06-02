import type { Attachment, DisplayAttachment } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DialDropdown,
  DialGhostIconButton,
  DialNeutralButton,
  DialPrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconPaperclip, IconPlus } from '@tabler/icons-react';
import { type FC, useCallback, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import type { EditMessageInputProps } from '../../models/ConversationInput.js';
import { AttachmentTray } from '../AttachmentTray/AttachmentTray.js';
import { BottomSheet } from '../BottomSheet/BottomSheet.js';
import { Input } from '../Input/Input.js';

export const EditMessageInput: FC<EditMessageInputProps> = ({
  message,
  initialAttachments = [],
  onCancel,
  onSave,
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
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [pendingDropFiles, setPendingDropFiles] = useState<File[]>([]);
  const [currentText, setCurrentText] = useState(message ?? '');
  const [currentNewAttachments, setCurrentNewAttachments] = useState<
    Attachment[]
  >([]);
  const [keptAttachments, setKeptAttachments] =
    useState<DisplayAttachment[]>(initialAttachments);

  const canSend = currentText.trim().length > 0;

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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      e.target.value = '';
      setPendingDropFiles(files);
    },
    [],
  );

  const addMenuItems = useMemo(
    () => [
      {
        key: 'attach',
        label: attachLabel,
        icon: <IconPaperclip size={BASE_ICON_SIZE} aria-hidden />,
        onClick: () => fileInputRef.current?.click(),
      },
    ],
    [attachLabel],
  );

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
          {isMobile ? (
            <>
              <DialGhostIconButton
                icon={<IconPlus size={BASE_ICON_SIZE} aria-hidden />}
                aria-label={addMenuLabel}
                className="size-10 flex-shrink-0"
                onClick={() => setIsSheetOpen(true)}
              />
              <BottomSheet
                isOpen={isSheetOpen}
                title={menuTitle}
                closeLabel={menuCloseLabel}
                onClose={() => setIsSheetOpen(false)}
                items={addMenuItems}
              />
            </>
          ) : (
            <DialDropdown
              matchReferenceWidth={false}
              placement="bottom-start"
              listClassName="!w-[240px]"
              menu={{ items: addMenuItems }}
            >
              <DialGhostIconButton
                icon={<IconPlus size={BASE_ICON_SIZE} aria-hidden />}
                aria-label={addMenuLabel}
                className="size-10 flex-shrink-0"
              />
            </DialDropdown>
          )}
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
