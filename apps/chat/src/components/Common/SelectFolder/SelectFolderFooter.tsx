import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import FolderPlus from '@/public/images/icons/folder-plus.svg';

interface Props {
  handleNewFolder: () => void;
  onSelectFolderClick: () => void;
}

export const SelectFolderFooter = ({
  handleNewFolder,
  onSelectFolderClick,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex items-center justify-between border-t border-tertiary px-3 py-4 md:px-6">
      <div className="flex items-center justify-center">
        <button
          onClick={() => handleNewFolder()}
          className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
          data-qa="new-folder"
        >
          <FolderPlus height={24} width={24} />
        </button>
      </div>
      <div>
        <button
          onClick={onSelectFolderClick}
          className="button button-primary"
          data-qa="select-folder"
        >
          {t('Select folder')}
        </button>
      </div>
    </div>
  );
};
