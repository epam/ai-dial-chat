import { IconDots, IconPaperclip } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Feature } from '@/src/types/features';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { Menu, MenuItem } from '../../Common/DropdownMenu';
import { FileManagerModal } from '../../Files/FileManagerModal';

export const ChatbarSettingsContextMenu = () => {
  const { t } = useTranslation('chatbar');
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const availableAttachmentsTypes = useAppSelector(
    ConversationsSelectors.selectAvailableAttachmentsTypes,
  );
  const maximumAttachmentsAmount = useAppSelector(
    ConversationsSelectors.selectMaximumAttachmentsAmount,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const displayAttachmentFunctionality = enabledFeatures.has(
    Feature.AttachmentsManager,
  );

  return (
    <>
      <Menu
        type="contextMenu"
        trigger={
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded text-gray-500  hover:bg-green/15 hover:text-green">
            <IconDots className="rotate-90 " size={24} strokeWidth={1.5} />
          </div>
        }
      >
        {displayAttachmentFunctionality && (
          <MenuItem
            className="hover:bg-blue-500/20"
            item={
              <div className="flex items-center gap-3">
                <IconPaperclip className="shrink-0 text-gray-500" size={18} />
                <span>{t('Attachments')}</span>
              </div>
            }
            onClick={() => setIsSelectFilesDialogOpened(true)}
          />
        )}
      </Menu>

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={availableAttachmentsTypes}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={() => {
            setIsSelectFilesDialogOpened(false);
          }}
        />
      )}
    </>
  );
};
