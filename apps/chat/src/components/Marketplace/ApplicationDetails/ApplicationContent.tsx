import { getModelDescription } from '@/src/utils/app/application';
import { isMyApplication } from '@/src/utils/app/id';

import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { AuthSelectors } from '@/src/store/selectors';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

import { ApplicationInfo } from './ApplicationInfo';

interface Props {
  entity: DialAIEntityModel;
}

export const ApplicationDetailsContent = ({ entity }: Props) => {
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
        <ApplicationInfo
          entityInfo={{
            author: isMyApplication(entity) ? userName : entity?.owner,
            createdAt: entity.createdAt,
          }}
        />
      </section>
    </div>
  );
};
