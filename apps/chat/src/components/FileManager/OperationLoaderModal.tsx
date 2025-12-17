import { IconFolderShare } from '@tabler/icons-react';
import { useState } from 'react';

import { DialSpinner } from './Spinner';

import { ButtonVariant, DialButton, DialPopup } from '@epam/ai-dial-ui-kit';

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
        <DialButton
          className="w-fit"
          variant={ButtonVariant.Tertiary}
          label="Cancel"
          onClick={() => {
            setIsOpen(false);
            onCancel?.();
          }}
        />
      </div>
    </DialPopup>
  );
};
