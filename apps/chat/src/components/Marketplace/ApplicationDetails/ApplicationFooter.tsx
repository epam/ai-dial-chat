import { IconPlayerPlay, IconShare } from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelVersionSelect } from '../../Chat/ModelVersionSelect';

interface Props {
  modelType: string;
  entity: DialAIEntityModel;
}

export const ApplicationDetailsFooter = ({ modelType, entity }: Props) => {
  const { t } = useTranslation(Translation.Marketplace);

  const entities = useAppSelector(ModelsSelectors.selectModels);
  const entitiesMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const [selectedVersion, setSelectedVersion] = useState(entity.version);

  const groupedModels = useMemo(() => {
    return entities.filter((m) => entity.name === m.name);
  }, [entities, entity.name]);

  return (
    <section className="flex p-4 md:px-6">
      <div className="flex w-full items-center justify-between">
        <IconShare
          className="ml-3 text-accent-primary md:hidden [&_path]:fill-current"
          size={18}
        />
        <div className="flex w-full items-center justify-end gap-4">
          <ModelVersionSelect
            className="cursor-pointer"
            entities={groupedModels}
            currentEntity={
              groupedModels.find(
                (model) => model.version === selectedVersion,
              ) ?? groupedModels[0]
            }
            onSelect={function (id: string): void {
              setSelectedVersion(entitiesMap[id]?.version);
            }}
          />
          <button className="flex items-center gap-3 rounded bg-accent-primary px-3 py-2 text-sm font-semibold">
            <IconPlayerPlay size={18} />
            <span>
              {t('Use {{modelType}}', {
                modelType,
              })}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
};
