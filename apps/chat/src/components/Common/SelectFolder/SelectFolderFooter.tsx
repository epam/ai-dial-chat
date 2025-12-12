import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { HiddenItemsToggler } from '@/src/components/Buttons/HiddenItemsToggler';

import FolderPlus from '@/public/images/icons/folder-plus.svg';
import { ButtonVariant, DialButton } from '@epam/ai-dial-ui-kit';

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
  selectBtnText = 'Select folder',
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex items-center justify-between border-t border-tertiary px-3 py-4 md:px-6">
      <div className="flex items-center justify-center">
        <DialButton
          onClick={() => onCreateNewFolder()}
          className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
          data-qa="new-folder"
          iconBefore={<FolderPlus height={24} width={24} />}
        />

        {!!onToggleHiddenFolders && (
          <HiddenItemsToggler
            onClick={onToggleHiddenFolders}
            areItemsVisible={areHiddenFoldersVisible}
          />
        )}
      </div>
      <div>
        <DialButton
          onClick={onSelectFolderClick}
          label={t(selectBtnText)}
          variant={ButtonVariant.Primary}
          disabled={disableSelect}
        />
      </div>
    </div>
  );
};
