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
    <div className="invisible text-xxs text-error peer-invalid:peer-[.submitted]:visible peer-invalid:peer-[.submitted]:mb-4">
      {t(text)}
    </div>
  );
};
export default EmptyRequiredInputMessage;
