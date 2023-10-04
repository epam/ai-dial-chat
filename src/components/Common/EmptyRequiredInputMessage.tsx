import { useTranslation } from 'next-i18next';

interface Props {
  text?: string;
}

const EmptyRequiredInputMessage = ({
  text = 'Please fill in all required fields',
}: Props) => {
  const { t } = useTranslation('settings');
  return (
    <div className="invisible text-xxs text-red-800 peer-[.submitted]:peer-invalid:visible dark:text-red-400">
      {t(text)}
    </div>
  );
};
export default EmptyRequiredInputMessage;
