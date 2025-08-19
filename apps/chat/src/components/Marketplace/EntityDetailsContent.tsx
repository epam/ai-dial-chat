import { getModelDescription } from '@/src/utils/app/application';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

import { EntityInfo } from './EntityInfo';

interface Props {
  entity: { description?: string; createdAt?: number; author?: string };
}

export function EntityDetailsContent({ entity }: Props) {
  const userName = useAppSelector(AuthSelectors.selectUserName);

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
        <EntityInfo
          entityInfo={{
            author: entity?.author ? entity.author : userName,
            createdAt: entity?.createdAt,
          }}
        />
      </section>
    </div>
  );
}
