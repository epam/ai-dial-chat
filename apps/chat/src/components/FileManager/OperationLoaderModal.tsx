import { IconFolderShare } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { SideBarI18nKeys } from '@/src/constants/i18n';

import { DialSpinner } from './Spinner';

import { DialLinkButton, DialPopup } from '@epam/ai-dial-ui-kit';

interface OperationLoaderModalProps {
  title: string;
  text: string;
  onCancel?: () => void;
}

export const OperationLoaderModal = ({
  title,
  text,
  onCancel,
}: OperationLoaderModalProps) => {
  const { t } = useTranslation(Translation.SideBar);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <DialPopup
      className="!w-[280px]"
      open={isOpen}
      dividers={false}
      headerClassName="!hidden"
      onClose={() => setIsOpen(false)}
      closeOnOutsideClick={false}
    >
      <div className="flex flex-col items-center gap-6 p-9">
        <DialSpinner
          circleClassName="stroke-tertiary"
          particleClassName="stroke-accent-primary"
          size={120}
          icon={
            <IconFolderShare size={48} stroke={1} className="text-secondary" />
          }
        />
        <div className="flex flex-col gap-2 text-center text-primary">
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm">{text}</div>
        </div>
        <DialLinkButton
          className="w-fit"
          label={t(SideBarI18nKeys.Cancel)}
          onClick={() => {
            setIsOpen(false);
            onCancel?.();
          }}
        />
      </div>
    </DialPopup>
  );
};
