import { getModelDescription, getModelName } from '@/src/utils/app/application';
import { LocalesService } from '@/src/utils/app/data/locales-service';
import { getEntityLocals } from '@/src/utils/app/marketplace-localization';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { MarketplaceEntityInfoRow } from './MarketplaceEntityInfoRow';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

type LocalizedField = 'name' | 'description';

interface MarketplaceEntityLocalizedInfoRowProps {
  entity: MarketplaceEntity;
  locale: string;
  field: LocalizedField;
  label: string;
  dataQa?: string;
  valueClassName?: string;
}

export function MarketplaceEntityLocalizedInfoRow({
  entity,
  locale,
  field,
  label,
  dataQa,
  valueClassName,
}: MarketplaceEntityLocalizedInfoRowProps) {
  const primaryLocale = LocalesService.getPrimaryLocale();
  const locals = getEntityLocals(entity)
    .filter((item) => item[field])
    .sort((a, b) => {
      if (a.locale === primaryLocale) return -1;
      if (b.locale === primaryLocale) return 1;
      return 0;
    });

  if (locals.length > 1) {
    return (
      <MarketplaceEntityInfoRow
        label={label}
        dataQa={dataQa}
        valueClassName={valueClassName}
        noTooltip
        value={
          <div className="flex min-w-0 flex-col gap-1">
            {locals.map((item) => (
              <div key={item.locale} className="flex min-w-0 gap-1.5">
                <span className="shrink-0 text-secondary">
                  {`[${item.locale.toUpperCase()}]`}
                </span>
                <DialEllipsisTooltip
                  text={item[field]}
                  className="min-w-0 flex-1"
                />
              </div>
            ))}
          </div>
        }
      />
    );
  }

  const value =
    field === 'name'
      ? getModelName(entity, locale)
      : getModelDescription(entity, locale);

  return (
    <MarketplaceEntityInfoRow
      label={label}
      value={value}
      dataQa={dataQa}
      valueClassName={valueClassName}
    />
  );
}
