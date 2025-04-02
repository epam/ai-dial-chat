import { useMemo } from 'react';

import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { CustomChatViewer } from '@/src/components/AppsEditor/Settings/Previews/CustomChatViewer';

interface WidgetViewProps {
  id: string;
}

export const WidgetView = ({ id }: WidgetViewProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );

  const model = useMemo(() => modelsMap[id], [modelsMap, id]);

  const schema = useMemo(() => {
    return applicationTypeSchemas.find(
      (s) => s.id === model?.applicationTypeSchemaId,
    );
  }, [applicationTypeSchemas, model?.applicationTypeSchemaId]);

  if (!schema?.viewerUrl || !model) return null;

  return (
    <CustomChatViewer
      id={model.id}
      customViewerUrl={schema.viewerUrl}
      title={schema.displayName}
    />
  );
};
