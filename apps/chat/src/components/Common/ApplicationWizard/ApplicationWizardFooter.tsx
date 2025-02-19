import { FC } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import Tooltip from '@/src/components/Common/Tooltip';

interface ApplicationWizardFooterProps {
  isEdit?: boolean;
  isValid?: boolean;
}

export const ApplicationWizardFooter: FC<ApplicationWizardFooterProps> = ({
  isEdit,
  isValid,
}) => {
  const { t } = useTranslation(Translation.Chat);
  return (
    <>
      <div className="flex justify-end gap-2 border-t border-tertiary p-4 md:px-6">
        <Tooltip
          hideTooltip={isValid}
          tooltip={t('Fill in all required fields or correct values')}
        >
          <button
            className="button button-primary"
            disabled={!isValid}
            data-qa="add-application"
            type="submit"
          >
            {isEdit ? t('Save') : t('Add')}
          </button>
        </Tooltip>
      </div>
    </>
  );
};
