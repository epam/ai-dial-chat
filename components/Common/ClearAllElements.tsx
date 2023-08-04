import { IconCheck, IconTrash, IconX } from '@tabler/icons-react';
import { FC, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { SidebarButton } from '@/components/Sidebar/SidebarButton';

interface Props {
  onClearAll: () => void;
  translation: string;
  elementsType: 'conversations' | 'prompts';
}

export const ClearAllElements: FC<Props> = ({
  onClearAll,
  translation,
  elementsType,
}) => {
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  const { t } = useTranslation(translation);

  const handleClearConversations = () => {
    onClearAll();
    setIsConfirming(false);
  };

  return isConfirming ? (
    <div className="flex w-full cursor-pointer items-center rounded-lg p-3 hover:bg-gray-500/10">
      <IconTrash size={18} />

      <div className="ml-3 flex-1 text-left text-[12.5px] leading-3">
        {t('Are you sure?')}
      </div>

      <div className="flex w-[40px]">
        <IconCheck
          className="ml-auto mr-1 min-w-[20px]"
          size={18}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleClearConversations();
          }}
        />

        <IconX
          className="ml-auto min-w-[20px]"
          size={18}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsConfirming(false);
          }}
        />
      </div>
    </div>
  ) : (
    <SidebarButton
      text={t(`Clear ${elementsType}`)}
      icon={<IconTrash size={18} />}
      onClick={() => setIsConfirming(true)}
    />
  );
};
