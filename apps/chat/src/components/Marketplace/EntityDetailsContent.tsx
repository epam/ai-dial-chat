import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';

import { Translation } from '@/src/types/translation';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

import { EntityInfo } from './EntityInfo';

interface Props {
  entity: { description?: string; createdAt?: number; author?: string };
}

export function EntityDetailsContent({ entity }: Props) {
  const { t } = useTranslation(Translation.Marketplace);

  const entityInfo = useMemo(
    () => ({
      author: entity?.author ?? t('Unknown'),
      createdAt: entity?.createdAt,
    }),
    [entity.author, entity?.createdAt, t],
  );

  return (
    <div
      className="divide-y divide-tertiary overflow-auto"
      data-qa="application-content"
    >
      {!!getModelDescription(entity) && (
        <section className="px-3 py-4 md:p-6" data-qa="application-description">
          <div className="flex flex-col gap-4">
            <EntityMarkdownDescription className="!text-sm !leading-[21px]">
              {getModelDescription(entity) ?? ''}
            </EntityMarkdownDescription>
          </div>
        </section>
      )}
      <section
        className="flex flex-col gap-3 overflow-auto px-3 py-4 md:px-6"
        data-qa="application-information"
      >
        <EntityInfo entityInfo={entityInfo} />
      </section>
    </div>
  );
}
