import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

interface Props {
  text?: string;
}

const EmptyRequiredInputMessage = ({
  text = 'Please fill in all required fields',
}: Props) => {
  const { t } = useTranslation(Translation.Settings);
  return (
    <div className="invisible text-xxs text-red-800 peer-invalid:peer-[.submitted]:visible peer-invalid:peer-[.submitted]:mb-4 dark:text-red-400">
      {t(text)}
    </div>
  );
};
export default EmptyRequiredInputMessage;
