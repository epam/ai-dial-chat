import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

interface Props {
  size: number;
  label: string;
}

export const HeaderItem: React.FC<Props> = ({ label, size }) => {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <div
      className="group flex items-center gap-2 font-semibold"
      style={{ width: `${size}px`, minWidth: `${size}px` }}
    >
      {t(label)}
      {/* <IconArrowNarrowDown
        className="invisible text-secondary group-hover:visible"
        size={16}
      /> */}
    </div>
  );
};
