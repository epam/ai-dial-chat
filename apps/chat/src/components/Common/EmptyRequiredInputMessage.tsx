import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  text?: string;
  useDisplay?: boolean;
  className?: string;
  isShown?: boolean;
}

const EmptyRequiredInputMessage = ({
  text = 'common.input.empty_required_message',
  useDisplay = false,
  className,
  isShown,
}: Props) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className={classNames(
        'text-xxs text-pr-alert-500 peer-invalid:peer-[.submitted]:mb-1',
        useDisplay && 'hidden peer-invalid:peer-[.submitted]:block',
        !useDisplay &&
          !isShown &&
          'invisible peer-invalid:peer-[.submitted]:visible',
        className,
      )}
    >
      {t(text)}
    </div>
  );
};
export default EmptyRequiredInputMessage;
