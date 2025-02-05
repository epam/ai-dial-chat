import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface Props {
  isValid: boolean;
}

export const ApplicationSettingsFormFooter: React.FC<Props> = ({ isValid }) => {
  const { t } = useTranslation(Translation.Chat);
  return (
    <div
      className={classNames(
        'mt-auto flex gap-2 border-t border-tertiary p-4 md:px-6',
        'justify-end',
      )}
    >
      <button
        className="button button-primary"
        data-qa="save-application-general-info"
        type="submit"
        disabled={!isValid}
      >
        {t('Create')}
      </button>
    </div>
  );
};
