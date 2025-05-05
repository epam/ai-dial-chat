import { ReactNode } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { DateRenderer } from '../../Common/DateRenderer';

interface infoColumnProps {
  dataQa: string;
  infoLabel: string;
  children: ReactNode;
}

function InfoColumn({ dataQa, infoLabel, children }: infoColumnProps) {
  return (
    <div className="flex flex-col gap-2" data-qa={`${dataQa}-container`}>
      <span className=" w-[148px] whitespace-pre-wrap break-words font-semibold">
        {infoLabel}:
      </span>
      <span className="whitespace-pre-wrap break-words" data-qa={dataQa}>
        {children}
      </span>
    </div>
  );
}

interface Props {
  entityInfo: { createdAt?: number; author?: string };
}

export function ApplicationInfo({ entityInfo }: Props) {
  const { t } = useTranslation(Translation.Marketplace);

  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('Information')}</h3>
        {/*TODO implement 'Report a problem'*/}
        {/* <button className="flex items-center gap-3 text-accent-primary">
          <IconAlertCircle size={18} />
          <span>{t('Report a problem')}</span>
        </button> */}
      </div>

      <div className="flex gap-12 text-sm">
        <InfoColumn infoLabel={t('Author')} dataQa="author">
          {entityInfo?.author ?? t('Unknown')}
        </InfoColumn>

        {entityInfo.createdAt && (
          <InfoColumn infoLabel={t('Release date')} dataQa="created-at">
            <DateRenderer dateValue={entityInfo.createdAt} />
          </InfoColumn>
        )}
      </div>
    </>
  );
}
