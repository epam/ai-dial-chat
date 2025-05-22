import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationTypesSchemasSelectors,
  ModelsSelectors,
} from '@/src/store/selectors';

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
