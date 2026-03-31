import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { HiddenItemsToggler } from '@/src/components/Buttons/HiddenItemsToggler';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { DialGhostIconButton, DialPrimaryButton } from '@epam/ai-dial-ui-kit';

interface Props {
  onCreateNewFolder: () => void;
  onSelectFolderClick: () => void;
  onToggleHiddenFolders?: () => void;
  areHiddenFoldersVisible?: boolean;
  disableSelect?: boolean;
  selectBtnText?: string;
}

export const SelectFolderFooter = ({
  onCreateNewFolder,
  onSelectFolderClick,
  onToggleHiddenFolders,
  areHiddenFoldersVisible = false,
  disableSelect,
  selectBtnText = ChatI18nKeys.SelectFolderChat,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex items-center justify-between border-t border-tertiary px-3 py-4 md:px-6">
      <div className="flex items-center justify-center">
        <DialGhostIconButton
          onClick={() => onCreateNewFolder()}
          data-qa="new-folder"
          icon={
            <FolderPlus
              width={DEFAULT_ICON_SIZES.STANDARD}
              height={DEFAULT_ICON_SIZES.STANDARD}
            />
          }
        />

        {!!onToggleHiddenFolders && (
          <HiddenItemsToggler
            onClick={onToggleHiddenFolders}
            areItemsVisible={areHiddenFoldersVisible}
          />
        )}
      </div>
      <div>
        <DialPrimaryButton
          onClick={onSelectFolderClick}
          label={t(selectBtnText)}
          disabled={disableSelect}
          data-qa="select-folder"
        />
      </div>
    </div>
  );
};
