import { ReactNode, useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { DateRenderer } from '@/src/components/Common/DateRenderer';

interface infoColumnProps {
  dataQa: string;
  infoLabel: string;
  children: ReactNode;
}

function InfoColumn({ dataQa, infoLabel, children }: infoColumnProps) {
  return (
    <div className="flex flex-col gap-2" data-qa={`${dataQa}-container`}>
      <span className="w-[148px] whitespace-pre-wrap break-words font-semibold">
        {infoLabel}
      </span>
      <span className="whitespace-pre-wrap break-words" data-qa={dataQa}>
        {children}
      </span>
    </div>
  );
}

interface Props {
  entity: MarketplaceEntity;
}

export function EntityInfo({ entity }: Props) {
  const { t } = useTranslation(Translation.Marketplace);

  const isCollapsibleSection = entity.type === EntityType.Model;

  const Wrapper = useCallback(
    ({ children }: { children: ReactNode }) =>
      !isCollapsibleSection ? (
        <>{children}</>
      ) : (
        <CollapsibleSection
          name={t(MarketplaceI18nKeys.InformationMarketplace)}
          togglerClassName="!text-base font-semibold !text-primary"
          className="!p-0"
          caretIconClassName="!text-primary"
          caretIconArrowView
          caretIconSize={20}
        >
          {children}
        </CollapsibleSection>
      ),
    [isCollapsibleSection, t],
  );

  return (
    <Wrapper>
      {!isCollapsibleSection && (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-primary">
            {t(MarketplaceI18nKeys.InformationMarketplace)}
          </h3>
          {/*TODO implement 'Report a problem'*/}
          {/* <button className="flex items-center gap-3 text-accent-primary">
          <IconAlertCircle size={18} />
          <span>{t('Report a problem')}</span>
        </button> */}
        </div>
      )}

      <div
        className={classNames(
          'flex flex-col gap-6 text-sm sm:flex-row sm:gap-12',
          isCollapsibleSection && 'ps-7',
        )}
      >
        <InfoColumn
          infoLabel={t(MarketplaceI18nKeys.AuthorMarketplace)}
          dataQa="author"
        >
          {entity?.author ?? t(MarketplaceI18nKeys.UnknownMarketplace)}
        </InfoColumn>

        {entity.createdAt && (
          <InfoColumn
            infoLabel={t(MarketplaceI18nKeys.ReleaseDateMarketplace)}
            dataQa="created-at"
          >
            <DateRenderer dateValue={entity.createdAt} />
          </InfoColumn>
        )}
      </div>
    </Wrapper>
  );
}
