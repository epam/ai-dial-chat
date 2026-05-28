import classNames from 'classnames';

import {
  getModelDescription,
  isDialAiEntityModel,
} from '@/src/utils/app/application';

import { EntityType } from '@/src/types/common';
import { MarketplaceEntity } from '@/src/types/marketplace';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { ApplicationLimits } from '@/src/components/Marketplace/ApplicationDetails/ApplicationLimits';

import { EntityInfo } from './EntityInfo';

interface Props {
  entity: MarketplaceEntity;
}

export function EntityDetailsContent({ entity }: Props) {
  const showLimitsSection =
    isDialAiEntityModel(entity) && entity.type === EntityType.Model;

  return (
    <div
      className="divide-y divide-tertiary overflow-auto"
      data-qa="entity-content"
    >
      {!!getModelDescription(entity) && (
        <section className="px-3 py-4 md:p-6" data-qa="entity-description">
          <div className="flex flex-col gap-4">
            <EntityMarkdownDescription className="!text-sm !leading-[21px]">
              {getModelDescription(entity) ?? ''}
            </EntityMarkdownDescription>
          </div>
        </section>
      )}
      <section
        className={classNames(
          'flex flex-col overflow-auto px-3 py-4 md:px-6',
          showLimitsSection ? 'gap-4' : 'gap-5',
        )}
        data-qa="entity-information"
      >
        <EntityInfo entity={entity} />

        {showLimitsSection && <ApplicationLimits entity={entity} />}
      </section>
    </div>
  );
}
