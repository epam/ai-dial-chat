import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  text?: string;
  useDisplay?: boolean;
  className?: string;
}

const EmptyRequiredInputMessage = ({
  text = 'Please fill in all required fields',
  useDisplay = false,
  className,
}: Props) => {
  const { t } = useTranslation(Translation.Settings);
  return (
    <div
      className={classNames(
        'text-xxs text-error peer-invalid:peer-[.submitted]:mb-4',
        useDisplay
          ? 'hidden peer-invalid:peer-[.submitted]:block'
          : 'invisible peer-invalid:peer-[.submitted]:visible',
        className,
      )}
    >
      {t(text)}
    </div>
  );
};
export default EmptyRequiredInputMessage;
