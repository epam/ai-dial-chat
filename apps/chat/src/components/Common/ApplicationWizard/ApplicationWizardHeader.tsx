import { IconX } from '@tabler/icons-react';
import { FC } from 'react';

import { useTranslation } from 'next-i18next';

import { ApplicationType } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

const getTitle = (type: ApplicationType, isEdit?: boolean) =>
  `${isEdit ? 'Edit' : 'Add'} ${type}`;

interface ApplicationWizardHeaderProps {
  onClose: (v: boolean) => void;
  type: ApplicationType;
  isEdit?: boolean;
}

export const ApplicationWizardHeader: FC<ApplicationWizardHeaderProps> = ({
  onClose,
  type,
  isEdit,
}) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      <button
        onClick={() => onClose(false)}
        className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
        data-qa="close-application-dialog"
      >
        <IconX size={24} />
      </button>
      <div className="px-3 py-4 md:px-6">
        <h2 className="text-base font-semibold">{t(getTitle(type, isEdit))}</h2>
      </div>
    </>
  );
};
