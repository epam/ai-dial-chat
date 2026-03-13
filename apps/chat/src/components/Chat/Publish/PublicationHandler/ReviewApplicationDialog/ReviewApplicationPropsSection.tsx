import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';

interface Props {
  label: string;
  appProps: Record<string, string>;
  propsNames?: Record<string, string>;
}

export const ReviewApplicationPropsSection = ({
  label,
  appProps,
  propsNames,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <MarketplaceEntityInfoRow
      label={t(label)}
      value={
        <div className="flex flex-col gap-1">
          {Object.entries(appProps).map(([key, value]) => (
            <MarketplaceEntityInfoRow
              key={key}
              label={propsNames ? t(propsNames[key]) : key}
              value={value}
              wrapperClassName="flex"
              labelClassName="w-[122px] shrink-0 text-primary"
              valueClassName="shrink grow text-primary"
            />
          ))}
        </div>
      }
      valueClassName="shrink grow text-primary"
    />
  );
};
