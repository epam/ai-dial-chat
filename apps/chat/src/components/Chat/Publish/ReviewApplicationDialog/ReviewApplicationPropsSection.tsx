import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface ItemProps {
  itemLabel: string;
  itemValue: string;
}
export const ReviewApplicationPropsItem = ({
  itemLabel,
  itemValue,
}: ItemProps) => {
  return (
    <div className="flex gap-4 text-primary">
      <span className="w-[122px] shrink-0">{itemLabel}:</span>
      <span className="shrink grow">{itemValue}</span>
    </div>
  );
};

interface SectionProps {
  label: string;
  appProps: Record<string, string>;
  propsNames?: Record<string, string>;
}

export const ReviewApplicationPropsSection = ({
  label,
  appProps,
  propsNames,
}: SectionProps) => {
  const { t } = useTranslation(Translation.Chat);
  return (
    <div className="flex gap-4">
      <span className="w-[122px] shrink-0 text-secondary">{t(label)}:</span>
      <div className="shrink grow">
        {Object.entries(appProps).map(([key, value]) => {
          return (
            <ReviewApplicationPropsItem
              key={key}
              itemLabel={propsNames ? t(propsNames[key]) : key}
              itemValue={value}
            />
          );
        })}
      </div>
    </div>
  );
};
