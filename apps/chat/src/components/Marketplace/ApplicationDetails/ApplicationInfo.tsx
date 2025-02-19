import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

interface infoColumnProps {
  dataQa: string;
  infoLabel: string;
  info: string;
}

function InfoColumn({ dataQa, infoLabel, info }: infoColumnProps) {
  return (
    <div className="flex flex-col gap-4" data-qa={dataQa}>
      <span className=" w-[148px] whitespace-pre-wrap break-words font-semibold">
        {infoLabel}:
      </span>
      <span className="whitespace-pre-wrap break-words">{info}</span>
    </div>
  );
}

interface Props {
  entityInfo: { createdAt?: number; author?: string };
}

export function ApplicationInfo({ entityInfo }: Props) {
  const { t } = useTranslation(Translation.Marketplace);
  const releaseDate = useMemo(() => {
    return entityInfo.createdAt
      ? new Date(entityInfo.createdAt).toLocaleDateString()
      : undefined;
  }, [entityInfo.createdAt]);

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
        <InfoColumn
          infoLabel={t('Author')}
          info={entityInfo?.author ?? t('Unknown')}
          dataQa="author"
        />

        {releaseDate && (
          <InfoColumn
            infoLabel={t('Release date')}
            info={releaseDate}
            dataQa="created-at"
          />
        )}
      </div>
    </>
  );
}
